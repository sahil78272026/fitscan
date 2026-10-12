import base64
import json
import logging
import time
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger("corecontrol.gemini")

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


def extract_raw_image_bytes(data: bytes) -> bytes:
    if not data:
        return data
    # Strip data URI header if present (e.g. data:image/jpeg;base64,...)
    if data.startswith(b"data:") and b"," in data:
        try:
            _, b64_part = data.split(b",", 1)
            return base64.b64decode(b64_part)
        except Exception:
            pass
    # If Base64 string bytes (JPEG starts with /9j/, PNG with iVBORw, WebP with UklGR)
    if data.startswith(b"/9j/") or data.startswith(b"iVBORw") or data.startswith(b"UklGR"):
        try:
            return base64.b64decode(data)
        except Exception:
            pass
    return data


def detect_image_mime_type(data: bytes, fallback_mime: str = "image/jpeg") -> str:
    if not data or len(data) < 8:
        return "image/jpeg"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"\x47\x49\x46\x38"):
        return "image/gif"
    if fallback_mime and fallback_mime.startswith("image/"):
        return fallback_mime
    return "image/jpeg"


async def analyze_food(raw_input: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> dict:
    """
    Send food text and optional image to Gemini for structured calorie & macro breakdown.
    Returns dict with 'items', 'total_calories', 'total_protein', 'total_carbs', 'total_fat'.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    contents = []
    if image_bytes:
        raw_bytes = extract_raw_image_bytes(image_bytes)
        safe_mime = detect_image_mime_type(raw_bytes, mime_type)
        logger.info(f"Analyzing image: received_len={len(image_bytes)}, decoded_len={len(raw_bytes)}, mime={safe_mime}")
        contents.append(
            types.Part.from_bytes(data=raw_bytes, mime_type=safe_mime)
        )
    
    prompt_text = raw_input if raw_input and raw_input.strip() else "Analyze the food in this image and provide complete calorie & macro breakdown."
    contents.append(prompt_text)

    start_time = time.perf_counter()
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
        duration = time.perf_counter() - start_time
        logger.info(f"Gemini API call (analyze_food) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")

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
        duration = time.perf_counter() - start_time
        logger.error(f"Failed to parse Gemini response as JSON after {duration:.2f}s: {e}")
        raise ValueError("Failed to parse AI response. Please try again.")
    except Exception as e:
        duration = time.perf_counter() - start_time
        logger.error(f"Gemini API error (analyze_food) after {duration:.2f}s: {e}")
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

CRITICAL DIET PREFERENCE & VARIETY RULES (MUST BE STRICTLY FOLLOWED):
1. SOYA CAP & DIVERSITY RULE: Do NOT overuse Soya Bean / Soya Chunks! Soya chunks MUST NOT appear in more than 1 meal out of 4 per day (maximum once per daily plan). Ensure rich culinary variety across meals using diverse Indian staples.
2. If diet_type is "non_veg": You MUST feature non-vegetarian protein sources (e.g. Chicken, Eggs, Fish, Mutton) in at least 2 out of the 4 meals per plan.
3. If diet_type is "vegan": STRICTLY 100% plant-based! NO dairy (milk, paneer, curd, ghee), NO eggs, NO meat, NO fish, NO honey. Use Kala Chana, Rajma, Moong Sprouts, Sattu (Roasted Chana Flour), Besan (Chickpea Flour Chilla), Tofu, Lentils/Dals (Masoor, Toor, Chana Dal), Roasted Peanuts, Oats, and Soya Chunks (max once/day).
4. If diet_type is "veg": STRICTLY Vegetarian! NO meat, NO chicken, NO fish, NO eggs. Use Paneer, Curd/Dahi, Chaach, Kala Chana, Rajma, Moong Sprouts, Sattu, Besan Chilla, Dals, Milk, Peanuts, and Soya Chunks (max once/day).
5. If diet_type is "eggetarian": Vegetarian + Eggs. MUST include egg dishes (Egg Bhurji, Boiled Eggs, Omelettes, Egg Curry) alongside vegetarian staples. NO meat or fish.

FITNESS GOAL RULES:
- "fat_loss": Prioritize high protein density (>2.0g/kg), low refined sugars, and high-fiber vegetables for satiety during deficit.
- "weight_loss": Moderate caloric deficit with balanced whole foods and portion control.
- "muscle_building": Caloric surplus with high protein and complex carbohydrates (oats, brown rice, whole wheat rotis) for workout performance and recovery.
- "muscle_maintain": Balanced maintenance macros and steady energy.

BUDGET TIER RULES:
- "low_budget": Use diverse, highly affordable local market staples (Kala Chana, Rajma, Moong Sprouts, Besan Chilla, Sattu, Dahi/Chaach, Eggs, Masoor/Toor Dal, Roasted Peanuts, Seasonal Veggies, Rice, Wheat Rotis). Do NOT rely heavily on Soya Chunks. Estimated cost: ~₹100-140/day.
- "moderate": Use balanced everyday staples (Paneer, Eggs, Local Chicken, Oats, Milk, Curd, Tofu, Dals). Estimated cost: ~₹180-250/day.
- "flexible": Premium options allowed (Whey Protein, Fish/Salmon, Avocados, Nuts, Greek Yogurt). Estimated cost: ~₹300+/day.

MACRO SUMMATION REQUIREMENT:
For each plan, the sum of the 4 meals (Breakfast, Lunch, Snack, Dinner):
- sum(meal.calories) MUST equal approximately {calorie_goal} kcal (within ±5%).
- sum(meal.protein) MUST equal approximately {protein_goal} g (within ±5%).
- sum(meal.carbs) MUST equal approximately {carbs_goal} g (within ±5%).
- sum(meal.fat) MUST equal approximately {fat_goal} g (within ±5%).

LANGUAGE & BREVITY RULES (CRITICAL):
- Use direct, human, crisp language. ZERO robotic fluff or filler words.
- dish_name: MUST be exactly 2 to 3 words only (e.g., "Paneer Bhurji Toast", "Dal Tadka Rice", "Egg Bhurji Roti", "Chicken Quinoa Bowl", "Sprouted Moong Salad"). NO long compound names.
- Tagline: Max 8-10 words. Simple reason why it works (e.g. "High protein vegetarian plan using affordable daily staples.").
- ingredients: Array of 3 to 5 bullet items with exact quantities (e.g. ["100g paneer", "2 whole wheat rotis", "1 tsp oil & cumin"]). NO long paragraphs.
- description: Single short prep sentence under 12 words (e.g. "Sauté paneer with spices and serve warm with rotis.").

Return ONLY a valid JSON object matching this exact structure (do NOT include markdown codeblocks or extra text):
{{
  "plans": [
    {{
      "plan_id": "plan_1",
      "title": "Short Title (2-3 words)",
      "tagline": "Brief 1-line reason why this matches their goal.",
      "daily_calories": {calorie_goal},
      "protein_g": {protein_goal},
      "carbs_g": {carbs_goal},
      "fat_g": {fat_goal},
      "estimated_cost": "~₹180/day",
      "meals": [
        {{
          "meal_type": "Breakfast",
          "dish_name": "Paneer Bhurji Toast",
          "calories": 450,
          "protein": 30.0,
          "carbs": 45.0,
          "fat": 12.0,
          "ingredients": [
            "100g paneer",
            "2 brown bread slices",
            "1 tsp oil & onion"
          ],
          "description": "Sauté paneer with spices and serve on toasted bread."
        }},
        {{
          "meal_type": "Lunch",
          "dish_name": "Dal Tadka Rice",
          "calories": 600,
          "protein": 45.0,
          "carbs": 65.0,
          "fat": 18.0,
          "ingredients": [
            "1 bowl toor dal",
            "1 cup cooked rice",
            "1 cucumber salad"
          ],
          "description": "Cook dal with turmeric and temper with cumin and ghee."
        }},
        {{
          "meal_type": "Snack",
          "dish_name": "Sprouted Moong Salad",
          "calories": 250,
          "protein": 15.0,
          "carbs": 30.0,
          "fat": 8.0,
          "ingredients": [
            "1 cup boiled sprouts",
            "Chopped tomatoes & lemon",
            "10g roasted peanuts"
          ],
          "description": "Toss sprouts with lemon juice and roasted peanuts."
        }},
        {{
          "meal_type": "Dinner",
          "dish_name": "Soya Chunks Curry",
          "calories": 500,
          "protein": 40.0,
          "carbs": 45.0,
          "fat": 15.0,
          "ingredients": [
            "40g soya chunks",
            "2 wheat rotis",
            "Tomato onion gravy"
          ],
          "description": "Simmer boiled soya in light curry and serve with rotis."
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
    t_start = time.perf_counter()
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
        duration = time.perf_counter() - t_start
        logger.info(f"Gemini API call (recommend_curated_meals) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")
        return _parse_json_from_text(response.text)
    except Exception as e:
        duration = time.perf_counter() - t_start
        logger.warning(f"Standard JSON meal generation failed after {duration:.2f}s, attempting grounded search: {e}")

    # Second attempt: Grounded search without response_mime_type (unsupported together by Gemini API)
    t_search_start = time.perf_counter()
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
        duration = time.perf_counter() - t_search_start
        logger.info(f"Gemini API call with search (recommend_curated_meals) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")
        return _parse_json_from_text(response.text)
    except Exception as err:
        duration = time.perf_counter() - t_search_start
        logger.error(f"Failed to generate meal recommendations after {duration:.2f}s: {err}")
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

    t_start = time.perf_counter()
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.4,
            ),
        )
        duration = time.perf_counter() - t_start
        logger.info(f"Gemini API call (generate_multiple_meal_plans) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")
        return _parse_json_from_text(response.text)
    except Exception as e:
        duration = time.perf_counter() - t_start
        logger.error(f"Failed to generate multiple meal plans after {duration:.2f}s: {e}")
        raise ValueError("Unable to generate candidate meal plans. Please try again.")


MORNING_BRIEFING_PROMPT = """You are a direct, supportive personal fitness coach.
A user just opened their app this morning. Review their nutrition from yesterday.

USER TARGETS:
- Name: {user_name}
- Goal: {goal_type}
- Targets: {calorie_goal} kcal | {protein_goal}g Protein

YESTERDAY:
- Logged: {yesterday_calories} kcal (Target: {calorie_goal} kcal)
- Protein: {yesterday_protein}g (Target: {protein_goal}g)
- Meals Logged: {yesterday_meal_count}
{yesterday_meals_summary}

STYLE RULES:
- ZERO fluff. NO flowery greetings or corporate cheerleader words ("champion", "thrive", "fueling journey").
- greeting: Exactly "Good morning, {user_name}!" (or "Good morning!").
- status_badge: 1 to 2 words only ("On Target", "Low Protein", "High Calories", "Fresh Start").
- feedback: Exactly ONE direct, human sentence (max 15 words) reviewing yesterday.
- improvements: Exactly 2 practical bullet points (each under 10 words).
- focus_today: Short phrase under 6 words.

Return ONLY valid JSON matching this schema:
{{
  "greeting": "Good morning, {user_name}!",
  "status_badge": "On Target | Low Protein | High Calories | Fresh Start",
  "feedback": "One clear sentence reviewing calories and protein.",
  "improvements": [
    "🍳 Tip 1 (under 10 words)",
    "💧 Tip 2 (under 10 words)"
  ],
  "focus_today": "Short focus (max 6 words)."
}}
"""


async def generate_morning_briefing(
    user_name: str,
    goal_type: str,
    diet_type: str,
    calorie_goal: int,
    protein_goal: int,
    carbs_goal: int,
    fat_goal: int,
    yesterday_calories: int,
    yesterday_protein: float,
    yesterday_carbs: float,
    yesterday_fat: float,
    yesterday_meal_count: int,
    yesterday_meals: list[dict]
) -> dict:
    """
    Generate an intelligent AI morning welcome, feedback, and daily improvement briefing.
    """
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Format yesterday meals summary
    if not yesterday_meals:
        meals_text = "No meals logged yesterday."
    else:
        meal_lines = []
        for m in yesterday_meals:
            meal_type = m.get("meal_type", "meal").capitalize()
            cals = m.get("total_calories", 0)
            items = ", ".join([it.get("name", "") for it in m.get("food_items", []) if it.get("name")])
            meal_lines.append(f"- {meal_type} ({cals} kcal): {items or m.get('raw_input', 'Logged food')}")
        meals_text = "\n".join(meal_lines)

    goal_labels = {
        "fat_loss": "Fat Loss",
        "weight_loss": "Weight Loss",
        "muscle_building": "Muscle Building",
        "muscle_maintain": "Maintenance",
    }

    clean_name = (user_name or "there").strip().split(" ")[0].capitalize()

    prompt = MORNING_BRIEFING_PROMPT.format(
        user_name=clean_name,
        goal_type=goal_labels.get(goal_type, goal_type or "Fat Loss"),
        calorie_goal=calorie_goal,
        protein_goal=protein_goal,
        carbs_goal=carbs_goal,
        fat_goal=fat_goal,
        yesterday_calories=yesterday_calories,
        yesterday_protein=yesterday_protein,
        yesterday_carbs=yesterday_carbs,
        yesterday_fat=yesterday_fat,
        yesterday_meal_count=yesterday_meal_count,
        yesterday_meals_summary=meals_text
    )

    t_start = time.perf_counter()
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
        duration = time.perf_counter() - t_start
        logger.info(f"Gemini API call (generate_morning_briefing) completed in {duration:.2f}s")
        return _parse_json_from_text(response.text)
    except Exception as e:
        duration = time.perf_counter() - t_start
        logger.error(f"Failed to generate morning briefing after {duration:.2f}s: {e}")
        # Crisp, human fallback with zero fluff
        if yesterday_meal_count == 0:
            return {
                "greeting": f"Good morning, {clean_name}! ☀️",
                "status_badge": "Fresh Start",
                "feedback": "No meals were logged yesterday. Start fresh today by tracking your breakfast.",
                "improvements": [
                    "🍳 Have a high-protein breakfast to stay full longer.",
                    "💧 Drink a large glass of water to start your day."
                ],
                "focus_today": f"Hit your {calorie_goal} kcal target and track early."
            }

        prot_diff = protein_goal - yesterday_protein
        badge = "On Target" if yesterday_calories <= calorie_goal + 100 else "Calorie Surplus"
        if prot_diff > 30:
            badge = "Protein Low"

        return {
            "greeting": f"Good morning, {clean_name}! ☀️",
            "status_badge": badge,
            "feedback": f"Yesterday: {yesterday_calories} of {calorie_goal} kcal logged, with {yesterday_protein}g protein.",
            "improvements": [
                f"🍳 Aim for {protein_goal}g protein across today's meals.",
                "🥗 Keep dinner portions clean to hit your deficit."
            ],
            "focus_today": f"Hit your {protein_goal}g protein goal today."
        }




