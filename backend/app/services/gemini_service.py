import json
import logging
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger("fitscan.gemini")

SYSTEM_PROMPT = """You are an expert sports nutritionist and food scanner specializing in global and Indian cuisine. The user will provide text descriptions, an image, or both of what they ate or plan to eat.

Your job is to parse each food item, estimate quantities and portion sizes based on standard Indian & global serving measures, and calculate accurate macronutrients (Calories, Protein, Carbohydrates, Fat).

INDIAN STANDARD PORTION & SERVING BENCHMARKS:
1. KATORI (BOWLS):
   - Small Katori (approx. 120-150 ml / 120-150g): Standard serving for Dal, Sabzi, Curd, Raita, Kheer. (~100-140 kcal)
   - Medium Katori (approx. 180-200 ml / 180-200g): Large bowl for Curry, Soup, Chole, Rajma. (~160-220 kcal)
2. ROTI / BREADS:
   - 1 Standard Phulka / Wheat Roti (no ghee): ~30g raw wheat flour / 50-60g cooked → ~80-90 kcal (P: 3g, C: 18g, F: 1g).
   - 1 Ghee / Butter Roti: ~115-130 kcal.
   - 1 Paratha (Stuffed / Plain): ~180-250 kcal depending on oil/stuffing.
   - 1 Naan / Tandoori Roti: ~180-260 kcal.
3. RICE & BIRYANI:
   - 1 Katori Cooked Rice (Plain/Jeera): ~120-150g cooked → ~160-180 kcal (P: 3.5g, C: 36g, F: 0.5g).
   - 1 Plate Pulao / Veg Biryani: ~250-300g → ~350-450 kcal.
   - 1 Plate Chicken/Mutton Biryani: ~300-350g → ~500-650 kcal.
4. PROTEIN PORTIONS:
   - Paneer (1 curry piece / cube): ~20-25g → ~60-70 kcal (P: 4g, F: 5g).
   - Chicken (1 curry piece with bone): ~50-60g → ~90-110 kcal (P: 13g, C: 2g, F: 5g).
   - Egg (1 whole): ~50g → ~70-75 kcal (P: 6g, F: 5g).
   - Dals & Legumes (1 Small Katori cooked): ~120-150g → ~120-150 kcal (P: 6-8g).
5. DAHI / RAITA / CONDIMENTS:
   - 1 Small Katori Plain Curd / Raita: ~100-120g → ~60-90 kcal (P: 3-4g, C: 5g, F: 4g).
   - 1 tbsp Chutney / Pickle: ~15-20g → ~20-40 kcal.

RULES FOR VISUAL ESTIMATION & TEXT PARSING:
1. Parse input into individual food items (separate rice, curry, raita, rotis, paneer, etc.).
2. Use visual container recognition (steel thali, katori, plate depth) to judge portion sizes accurately.
3. If an item quantity is unspecified in text or image, infer portion size using the Indian Standard Benchmarks above.
4. Return ONLY valid JSON matching the exact schema below.

JSON RESPONSE SCHEMA:
{
  "items": [
    {
      "name": "Food item name",
      "quantity": 1.0,
      "unit": "katori | pieces | plate | grams",
      "calories": 250,
      "protein": 12.5,
      "carbs": 30.0,
      "fat": 8.0
    }
  ],
  "total_calories": 250,
  "total_protein": 12.5,
  "total_carbs": 30.0,
  "total_fat": 8.0
}
"""

MEAL_RECOMMENDATION_PROMPT = """You are a master nutritionist and budget culinary advisor.
Generate 4 highly curated, practical meal ideas (Breakfast, Lunch, Dinner, Snack) based on the user's criteria:

Criteria:
- Goal: {goal_type} (e.g. Fat Loss, Weight Loss, Muscle Building, Maintenance)
- Diet Preference: {diet_type} (e.g. Vegetarian, Non-Vegetarian, Vegan, Eggetarian)
- Budget Tier: {budget_tier} (e.g. Low Budget / Pocket Friendly, Moderate, Flexible / High Protein)
- Calorie Target: ~{calorie_goal} kcal/day

Rules:
1. Ensure meals fit the budget constraints using realistic ingredient pricing and readily available local market items.
2. Ensure high protein alignment for muscle building/fat loss goals.
3. Return ONLY a valid JSON object matching this structure:

{{
  "budget_tier": "{budget_tier}",
  "diet_type": "{diet_type}",
  "recommendations": [
    {{
      "dish_name": "High Protein Chana Dal & Brown Rice",
      "meal_type": "Lunch",
      "estimated_cost": "Budget Friendly (~$1.50 / ₹60 per serving)",
      "calories": 520,
      "protein": 24.0,
      "carbs": 75.0,
      "fat": 10.0,
      "description": "Nutritious chana dal simmered with spices served with brown rice and a side of cucumber salad.",
      "recipe_summary": "Pressure cook 1/2 cup chana dal with turmeric & salt. Temper with 1 tsp ghee, cumin, and garlic. Serve warm."
    }}
  ]
}}
"""


async def analyze_food(raw_input: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> dict:
    """
    Send food text and optional image to Gemini for structured calorie & macro breakdown.
    Returns dict with 'items', 'total_calories', 'total_protein', 'total_carbs', 'total_fat'.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    contents = []
    if image_bytes:
        contents.append(
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        )
    
    prompt_text = raw_input if raw_input and raw_input.strip() else "Analyze the food in this image and provide complete calorie & macro breakdown."
    contents.append(prompt_text)

    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        result = json.loads(response.text)

        # Ensure defaults if keys are missing
        if "items" not in result:
            result["items"] = []

        total_cal = 0
        total_p = 0.0
        total_c = 0.0
        total_f = 0.0

        for item in result["items"]:
            item["calories"] = int(item.get("calories", 0))
            item["protein"] = float(item.get("protein", 0.0))
            item["carbs"] = float(item.get("carbs", 0.0))
            item["fat"] = float(item.get("fat", 0.0))
            
            total_cal += item["calories"]
            total_p += item["protein"]
            total_c += item["carbs"]
            total_f += item["fat"]

        result["total_calories"] = int(result.get("total_calories", total_cal))
        result["total_protein"] = round(float(result.get("total_protein", total_p)), 1)
        result["total_carbs"] = round(float(result.get("total_carbs", total_c)), 1)
        result["total_fat"] = round(float(result.get("total_fat", total_f)), 1)

        logger.info(f"Gemini analyzed food -> {result['total_calories']} kcal (P: {result['total_protein']}g, C: {result['total_carbs']}g, F: {result['total_fat']}g)")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        raise ValueError("Failed to parse AI response. Please try again.")
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        raise


import re

def _parse_json_from_text(text: str) -> dict:
    """Extract and parse JSON object from raw Gemini text response."""
    clean_text = text.strip()

    # Search for markdown fenced code blocks ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean_text, re.DOTALL)
    if match:
        clean_text = match.group(1)
    else:
        # Search for first { to last }
        match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
        if match:
            clean_text = match.group(1)

    return json.loads(clean_text)


MULTIPLE_MEAL_PLANS_PROMPT = """You are an expert sports nutritionist and budget culinary advisor.
Generate 3 DISTINCT 1-day Meal Plans tailored STRICTLY to the user's explicit parameters:

USER PARAMETERS:
- Fitness Goal: {goal_type}
- Dietary Preference: {diet_type}
- Budget Tier: {budget_tier}
- Target Daily Calories: {calorie_goal} kcal
- Target Daily Protein: {protein_goal} g
- Target Daily Carbs: {carbs_goal} g
- Target Daily Fat: {fat_goal} g

CRITICAL DIET PREFERENCE RULES (MUST BE STRICTLY FOLLOWED):
1. If diet_type is "non_veg": You MUST feature non-vegetarian protein sources (e.g. Chicken, Eggs, Fish, Mutton) in at least 2 out of the 4 meals per plan.
2. If diet_type is "vegan": STRICTLY 100% plant-based! NO dairy (milk, paneer, curd, ghee), NO eggs, NO meat, NO fish, NO honey. Use Tofu, Soya Chunks, Legumes, Lentils, Seeds, and Oats.
3. If diet_type is "veg": STRICTLY Vegetarian! NO meat, NO chicken, NO fish, NO eggs. Use Paneer, Soya, Dals, Rajma, Milk, Curd, and Sprouts.
4. If diet_type is "eggetarian": Vegetarian + Eggs. MUST include egg dishes (Egg Bhurji, Boiled Eggs, Omelettes, Egg Curry) alongside vegetarian staples. NO meat or fish.

FITNESS GOAL RULES:
- "fat_loss": Prioritize high protein density (>2.0g/kg), low refined sugars, and high-fiber vegetables for satiety during deficit.
- "weight_loss": Moderate caloric deficit with balanced whole foods and portion control.
- "muscle_building": Caloric surplus with high protein and complex carbohydrates (oats, brown rice, whole wheat rotis) for workout performance and recovery.
- "muscle_maintain": Balanced maintenance macros and steady energy.

BUDGET TIER RULES:
- "low_budget": Use budget-friendly local market staples (Eggs, Chana, Rajma, Soya Chunks, Seasonal Veggies, Rice, Wheat Rotis). Estimated cost: ~₹100-140/day.
- "moderate": Use balanced everyday staples (Paneer, Local Chicken, Oats, Milk, Curd, Tofu). Estimated cost: ~₹180-250/day.
- "flexible": Premium options allowed (Whey Protein, Fish/Salmon, Avocados, Nuts, Greek Yogurt). Estimated cost: ~₹300+/day.

MACRO SUMMATION REQUIREMENT:
For each plan, the sum of the 4 meals (Breakfast, Lunch, Snack, Dinner):
- sum(meal.calories) MUST equal approximately {calorie_goal} kcal (within ±5%).
- sum(meal.protein) MUST equal approximately {protein_goal} g (within ±5%).
- sum(meal.carbs) MUST equal approximately {carbs_goal} g (within ±5%).
- sum(meal.fat) MUST equal approximately {fat_goal} g (within ±5%).

Return ONLY a valid JSON object matching this exact structure (do NOT include markdown codeblocks or extra text):
{{
  "plans": [
    {{
      "plan_id": "plan_1",
      "title": "Short Inspiring Title matched to Goal & Diet",
      "tagline": "1-line explanation of why this plan fits their goal",
      "daily_calories": {calorie_goal},
      "protein_g": {protein_goal},
      "carbs_g": {carbs_goal},
      "fat_g": {fat_goal},
      "estimated_cost": "Estimated Cost String (e.g. ~₹180/day)",
      "meals": [
        {{
          "meal_type": "Breakfast",
          "dish_name": "Name of Dish matching diet_type",
          "calories": 450,
          "protein": 30.0,
          "carbs": 45.0,
          "fat": 12.0,
          "description": "Short description of ingredients and preparation."
        }},
        {{
          "meal_type": "Lunch",
          "dish_name": "Name of Dish matching diet_type",
          "calories": 600,
          "protein": 45.0,
          "carbs": 65.0,
          "fat": 18.0,
          "description": "Short description of ingredients and preparation."
        }},
        {{
          "meal_type": "Snack",
          "dish_name": "Name of Dish matching diet_type",
          "calories": 250,
          "protein": 15.0,
          "carbs": 30.0,
          "fat": 8.0,
          "description": "Short description of ingredients and preparation."
        }},
        {{
          "meal_type": "Dinner",
          "dish_name": "Name of Dish matching diet_type",
          "calories": 500,
          "protein": 40.0,
          "carbs": 45.0,
          "fat": 15.0,
          "description": "Short description of ingredients and preparation."
        }}
      ]
    }}
  ]
}}
"""


async def recommend_curated_meals(
    goal_type: str = "fat_loss",
    diet_type: str = "veg",
    budget_tier: str = "moderate",
    calorie_goal: int = 2000
) -> dict:
    """
    Generate market budget-friendly curated meal ideas using Gemini.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = MEAL_RECOMMENDATION_PROMPT.format(
        goal_type=goal_type,
        diet_type=diet_type,
        budget_tier=budget_tier,
        calorie_goal=calorie_goal
    )

    # First attempt: Try standard structured output prompt without search tool (fast & reliable)
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
        return _parse_json_from_text(response.text)
    except Exception as e:
        logger.warning(f"Standard JSON meal generation failed, attempting grounded search: {e}")

    # Second attempt: Grounded search without response_mime_type (unsupported together by Gemini API)
    try:
        search_tool = types.Tool(google_search=types.GoogleSearch())
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[search_tool],
                temperature=0.4,
            ),
        )
        return _parse_json_from_text(response.text)
    except Exception as err:
        logger.error(f"Failed to generate meal recommendations: {err}")
        raise ValueError("Unable to generate meal recommendations. Please try again.")


async def generate_multiple_meal_plans(
    goal_type: str = "fat_loss",
    diet_type: str = "veg",
    budget_tier: str = "moderate",
    calorie_goal: int = 2000,
    protein_goal: int = 150,
    carbs_goal: int = 200,
    fat_goal: int = 65
) -> dict:
    """
    Generate 3 distinct full-day meal plan options tailored strictly to user metrics & goals.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    diet_descriptions = {
        "non_veg": "Non-Vegetarian (MUST include Chicken, Eggs, Fish, or Mutton in meals)",
        "vegan": "100% Vegan (STRICTLY Plant-Based: NO milk, NO paneer, NO ghee, NO curd, NO eggs, NO meat, NO fish)",
        "veg": "Vegetarian (Pure Vegetarian: Paneer, Soya, Dals, Milk, Curd — NO meat, NO fish, NO eggs)",
        "eggetarian": "Eggetarian (Vegetarian + Eggs: Egg Bhurji, Boiled Eggs, Omelette — NO meat or fish)",
    }

    goal_descriptions = {
        "fat_loss": "Fat Loss (Caloric deficit with high protein density to burn fat & retain muscle)",
        "weight_loss": "Weight Loss (Steady caloric deficit, portion control & high fiber)",
        "muscle_building": "Muscle Building (Caloric surplus with high protein & complex carbs for muscle hypertrophy)",
        "muscle_maintain": "Maintenance (Maintain current weight with steady energy & balanced macros)",
    }

    budget_descriptions = {
        "low_budget": "Pocket Friendly / Low Budget (~₹100-140/day using local staples: Chana, Rajma, Eggs, Soya, Rice, Wheat)",
        "moderate": "Moderate Budget (~₹180-250/day using Paneer, Chicken, Oats, Milk, Curd, Tofu)",
        "flexible": "Flexible / Premium Budget (~₹300+/day using Whey Protein, Salmon/Fish, Avocados, Nuts)",
    }

    prompt = MULTIPLE_MEAL_PLANS_PROMPT.format(
        goal_type=goal_descriptions.get(goal_type, goal_type),
        diet_type=diet_descriptions.get(diet_type, diet_type),
        budget_tier=budget_descriptions.get(budget_tier, budget_tier),
        calorie_goal=calorie_goal,
        protein_goal=protein_goal,
        carbs_goal=carbs_goal,
        fat_goal=fat_goal
    )

    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.4,
            ),
        )
        return _parse_json_from_text(response.text)
    except Exception as e:
        logger.error(f"Failed to generate multiple meal plans: {e}")
        raise ValueError("Unable to generate candidate meal plans. Please try again.")



