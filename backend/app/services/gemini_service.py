import json
import logging
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger("fitscan.gemini")
settings = get_settings()

client = genai.Client(api_key=settings.GEMINI_API_KEY)

SYSTEM_PROMPT = """You are a precise nutrition expert. The user will tell you what they ate. 
Your job is to parse each food item, estimate its quantity, and provide accurate calorie counts.

Rules:
1. Parse the input into individual food items.
2. If quantity is not specified, assume 1 standard serving.
3. Use commonly accepted calorie values for each item.
4. Handle Indian foods well (roti, dal, rice, paratha, chai, etc.).
5. Be slightly conservative — better to slightly overestimate than underestimate.
6. Return ONLY valid JSON, no markdown, no explanation.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "name": "Human-readable food name",
      "quantity": 2.0,
      "unit": "pieces",
      "calories": 156
    }
  ],
  "total_calories": 323
}

The "calories" field should be the TOTAL calories for that item (quantity × per-unit calories).
The "total_calories" should be the sum of all item calories.
"""


async def analyze_food(raw_input: str) -> dict:
    """
    Send food text to Gemini and get structured calorie breakdown.
    Returns dict with 'items' list and 'total_calories'.
    """
    try:
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=raw_input,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,  # low temperature for consistent calorie estimates
            ),
        )

        result = json.loads(response.text)

        # Validate structure
        if "items" not in result or "total_calories" not in result:
            raise ValueError("Invalid response structure from Gemini")

        # Validate each item has required fields
        for item in result["items"]:
            required_keys = {"name", "quantity", "unit", "calories"}
            if not required_keys.issubset(item.keys()):
                raise ValueError(f"Food item missing required fields: {item}")

        logger.info(f"Gemini analyzed '{raw_input}' → {result['total_calories']} kcal, {len(result['items'])} items")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        raise ValueError("Failed to parse AI response. Please try again.")
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        raise
