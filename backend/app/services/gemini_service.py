import json
import logging
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger("fitscan.gemini")

SYSTEM_PROMPT = """You are an expert sports nutritionist and food scanner. The user will provide text descriptions, an image, or both of what they ate or plan to eat.

Your job is to parse each food item, estimate quantities and portion sizes, and calculate accurate macronutrients (Calories, Protein, Carbohydrates, Fat).

Rules:
1. Parse input into individual food items.
2. If an image is provided, use visual estimation to detect portion sizes and food items. Combine with any user text notes for context.
3. If quantity is not specified in text or visible in image, assume 1 standard serving.
4. Calculate Calories (kcal), Protein (g), Carbohydrates (g), and Fat (g) for each item.
5. Handle global and Indian foods accurately (roti, dal, paneer, paratha, eggs, rice, chicken, etc.).
6. Return ONLY valid JSON matching the specified schema.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "name": "Food item name",
      "quantity": 2.0,
      "unit": "pieces",
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


