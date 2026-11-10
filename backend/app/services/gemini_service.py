import asyncio
import base64
import io
import json
import logging
import time
import httpx
from PIL import Image, ImageOps
from google import genai
from google.genai import types, errors
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
3. LOW-OIL & HEALTHY COOKING RULES (STRICT):
   - ZERO DEEP-FRIED FOODS: Never suggest deep-fried items (puri, bhature, pakoras, samosas, vadas, fried snacks, fried cutlets/fish, bhajiyas).
   - NO HEAVY/OILY GRAVIES: Strictly avoid rich, greasy restaurant/dhaba-style curries with floating oil/ghee, excess butter, or heavy cream (e.g. butter chicken, shahi paneer, malai kofta).
   - PREFERRED PREPARATIONS: Prioritize boiled, steamed, dry-roasted, grilled, tandoori, or lightly sautéed dishes (e.g. idli, dhokla, dal with minimal oil tadka, boiled sprouts/chana, grilled paneer/chicken, dry egg bhurji).
   - COOKING OIL CAP: Limit added cooking oil/ghee to at most 1 teaspoon (5g) per meal for light tempering (tadka) or pan brushing. Healthy fats should come from whole foods (curd, nuts, seeds, eggs, paneer), never from floating refined oil.
4. Return ONLY a valid JSON object matching this structure:

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


def _safe_int(val, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def _safe_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def extract_raw_image_bytes(data: bytes) -> bytes:
    if not data:
        return data
    clean = data.strip()
    # Strip data URI header if present (e.g. data:image/jpeg;base64,...)
    if clean.startswith(b"data:") and b"," in clean:
        try:
            _, b64_part = clean.split(b",", 1)
            b64_clean = b64_part.strip()
            pad = len(b64_clean) % 4
            if pad:
                b64_clean += b"=" * (4 - pad)
            return base64.b64decode(b64_clean)
        except Exception:
            pass
    # If Base64 string bytes (JPEG starts with /9j/, PNG with iVBORw, WebP with UklGR, GIF with R0lGOD)
    if clean.startswith(b"/9j/") or clean.startswith(b"iVBORw") or clean.startswith(b"UklGR") or clean.startswith(b"R0lGOD"):
        try:
            pad = len(clean) % 4
            to_decode = clean + (b"=" * (4 - pad)) if pad else clean
            return base64.b64decode(to_decode)
        except Exception:
            pass
    return clean


def detect_image_mime_type(data: bytes, fallback_mime: str = "image/jpeg") -> str:
    if not data or len(data) < 8:
        return fallback_mime if fallback_mime and fallback_mime.startswith("image/") else "image/jpeg"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"\x47\x49\x46\x38"):
        return "image/gif"
    # HEIC / HEIF format detection: ftyp box containing heic/heix/hevc/mif1/msf1
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in (b"heic", b"heix", b"hevc", b"mif1", b"msf1"):
        return "image/heic"
    if fallback_mime and fallback_mime.startswith("image/"):
        return fallback_mime
    return "image/jpeg"


def optimize_image_for_analysis(image_bytes: bytes, original_mime: str = "image/jpeg", max_dim: int = 1280, quality: int = 85) -> tuple[bytes, str]:
    """
    Safely downscale and compress oversized images to improve Gemini upload and processing speed.
    Normalizes EXIF orientation and composites transparency on a clean white background.
    Falls back cleanly to original image bytes if Pillow encounters an unknown/unsupported format.
    """
    if not image_bytes or len(image_bytes) < 64:
        return image_bytes, original_mime
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            exif = img.getexif()
            orientation = exif.get(0x0112, 1) if exif else 1
            has_exif_rotation = orientation not in (1, None)

            w, h = img.size
            is_oversized = max(w, h) > max_dim
            is_overweight = len(image_bytes) > 1024 * 1024
            is_transparent = img.mode in ("RGBA", "LA") or ("transparency" in img.info)
            is_non_rgb = img.mode != "RGB"

            needs_processing = is_oversized or is_overweight or has_exif_rotation or is_transparent or is_non_rgb

            if not needs_processing:
                return image_bytes, original_mime

            if has_exif_rotation:
                transposed = ImageOps.exif_transpose(img)
                img = transposed if transposed is not None else img

            if is_oversized:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            if is_transparent:
                rgba = img.convert("RGBA")
                bg = Image.new("RGB", rgba.size, (255, 255, 255))
                bg.paste(rgba, mask=rgba.split()[-1])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")

            out = io.BytesIO()
            img.save(out, format="JPEG", quality=quality, optimize=True)
            return out.getvalue(), "image/jpeg"
    except Exception:
        pass
    return image_bytes, original_mime


async def analyze_food(raw_input: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> dict:
    """
    Send food text and optional image to Gemini for structured calorie & macro breakdown.
    Returns dict with 'items', 'total_calories', 'total_protein', 'total_carbs', 'total_fat'.
    """
    settings = get_settings()
    timeout_seconds = getattr(settings, "GEMINI_TIMEOUT_SECONDS", 35.0)
    http_opts = types.HttpOptions(timeout=int(timeout_seconds * 1000)) if timeout_seconds else None
    client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_opts)

    contents = []
    if image_bytes:
        raw_bytes = extract_raw_image_bytes(image_bytes)
        if raw_bytes and len(raw_bytes) > 0:
            safe_mime = detect_image_mime_type(raw_bytes, mime_type)
            optimized_bytes, safe_mime = await asyncio.to_thread(
                optimize_image_for_analysis, raw_bytes, safe_mime
            )
            logger.info(
                f"Analyzing image: received_len={len(image_bytes)}, processed_len={len(optimized_bytes)}, mime={safe_mime}"
            )
            if optimized_bytes and len(optimized_bytes) > 0:
                contents.append(
                    types.Part.from_bytes(data=optimized_bytes, mime_type=safe_mime)
                )
    
    prompt_text = raw_input if raw_input and raw_input.strip() else "Analyze the food in this image and provide complete calorie & macro breakdown."
    contents.append(prompt_text)

    start_time = time.perf_counter()
    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            ),
            timeout=timeout_seconds,
        )
        duration = time.perf_counter() - start_time
        logger.info(f"Gemini API call (analyze_food) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")

        result = _parse_json_from_text(response.text)
        if not isinstance(result, dict):
            result = {"items": []}

        raw_items = result.get("items")
        if not isinstance(raw_items, list):
            raw_items = []

        total_cal = 0
        total_p = 0.0
        total_c = 0.0
        total_f = 0.0

        sanitized_items = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            item["name"] = str(item.get("name") or "Food item").strip() or "Food item"
            item["quantity"] = _safe_float(item.get("quantity"), 1.0)
            item["unit"] = str(item.get("unit") or "serving").strip() or "serving"
            item["calories"] = _safe_int(item.get("calories"), 0)
            item["protein"] = _safe_float(item.get("protein"), 0.0)
            item["carbs"] = _safe_float(item.get("carbs"), 0.0)
            item["fat"] = _safe_float(item.get("fat"), 0.0)
            
            total_cal += item["calories"]
            total_p += item["protein"]
            total_c += item["carbs"]
            total_f += item["fat"]
            sanitized_items.append(item)

        result["items"] = sanitized_items
        result["total_calories"] = _safe_int(result.get("total_calories"), total_cal)
        result["total_protein"] = round(_safe_float(result.get("total_protein"), total_p), 1)
        result["total_carbs"] = round(_safe_float(result.get("total_carbs"), total_c), 1)
        result["total_fat"] = round(_safe_float(result.get("total_fat"), total_f), 1)

        logger.info(f"Gemini analyzed food -> {result['total_calories']} kcal (P: {result['total_protein']}g, C: {result['total_carbs']}g, F: {result['total_fat']}g)")
        return result

    except (asyncio.TimeoutError, TimeoutError, httpx.TimeoutException) as e:
        duration = time.perf_counter() - start_time
        logger.error(f"Gemini API call (analyze_food) timed out after {duration:.2f}s: {e}")
        raise TimeoutError(f"AI food scanning service timed out after {timeout_seconds:.1f}s")
    except errors.APIError as e:
        duration = time.perf_counter() - start_time
        err_msg = str(e).lower()
        err_code = getattr(e, "code", None)
        err_status = str(getattr(e, "status", "")).upper()
        if err_code in (408, 504) or "DEADLINE_EXCEEDED" in err_status or "deadline exceeded" in err_msg or "timed out" in err_msg:
            logger.error(f"Gemini API upstream timeout after {duration:.2f}s (code={err_code}, status={err_status}): {e}")
            raise TimeoutError(f"AI food scanning service timed out after {timeout_seconds:.1f}s")
        logger.error(f"Gemini API error (analyze_food) after {duration:.2f}s (code={err_code}): {e}")
        raise
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
    if not text or not isinstance(text, str) or not text.strip():
        raise ValueError("AI returned an empty response. Please try again.")
    clean_text = text.strip()

    # Search for markdown fenced code blocks ```json ... ```
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", clean_text, re.DOTALL)
    if match:
        clean_text = match.group(1).strip()
    else:
        # Search for first { to last } or first [ to last ]
        match = re.search(r"(\{.*\}|\[.*\])", clean_text, re.DOTALL)
        if match:
            clean_text = match.group(1).strip()

    try:
        data = json.loads(clean_text)
    except json.JSONDecodeError:
        # Strip trailing commas common in LLM outputs: e.g. {"a": 1,} or [1, 2,]
        sanitized = re.sub(r",\s*([}\]])", r"\1", clean_text)
        data = json.loads(sanitized)

    if isinstance(data, list):
        data = {"items": data}
    elif not isinstance(data, dict):
        raise ValueError("AI returned non-dictionary JSON.")

    return data


MULTIPLE_MEAL_PLANS_PROMPT = """You are an expert sports nutritionist and budget culinary advisor.
Generate 3 DISTINCT 1-day Meal Plans tailored STRICTLY to the user's explicit parameters:

USER PARAMETERS:
- Fitness Goal: {goal_type}
- Dietary Preference: {diet_type}
- Budget Tier: {budget_tier}
- Workout Routine & Timing: {workout_timing_desc}
- Target Daily Calories: {calorie_goal} kcal
- Target Daily Protein: {protein_goal} g
- Target Daily Carbs: {carbs_goal} g
- Target Daily Fat: {fat_goal} g

CRITICAL WORKOUT NUTRIENT TIMING RULES (MUST BE STRICTLY FOLLOWED):
1. IF MORNING WORKOUT (6 AM – 9 AM):
   - Breakfast is the POST-WORKOUT RECOVERY meal: Highest protein (30–40g) + clean complex carbs (e.g. paneer bhurji toast, oats & milk, or egg omelette) to replenish muscle glycogen and maximize Muscle Protein Synthesis.
   - Lunch and Dinner supply steady sustained energy.
2. IF MIDDAY / AFTERNOON WORKOUT (12 PM – 3 PM):
   - Breakfast supplies moderate energy.
   - Lunch is the POST-WORKOUT RECOVERY meal: Highest protein (35–45g) + complex carbs (dal, rice, curd, soya/chicken).
3. IF EVENING WORKOUT (5 PM – 8 PM):
   - Snack is PRE-WORKOUT FUEL (e.g. easily digestible carbs + light protein like banana toast, roasted chana, sattu drink, boiled sprouts eaten 60–90 min before workout; keep fat low for rapid digestion).
   - Dinner is the POST-WORKOUT RECOVERY meal: Highest protein meal of the day (35–45g protein) + wholesome carbs (rice/rotis) to repair muscle tissue overnight.
4. IF NIGHT WORKOUT (8 PM – 10 PM):
   - Dinner acts as pre-workout fuel (eaten light or earlier); provide a light post-workout protein replenishment (curd/milk/paneer/boiled eggs).
5. IF NO STRUCTURED WORKOUT / REST DAYS:
   - Distribute calories and protein evenly across all 4 meals according to standard circadian rhythm.

CRITICAL DIET PREFERENCE & VARIETY RULES (MUST BE STRICTLY FOLLOWED):
1. SOYA CAP & DIVERSITY RULE: Do NOT overuse Soya Bean / Soya Chunks! Soya chunks MUST NOT appear in more than 1 meal out of 4 per day (maximum once per daily plan). Ensure rich culinary variety across meals using diverse Indian staples.
2. LOW-OIL & HEALTHY COOKING RULES (STRICT):
   - ZERO DEEP-FRIED FOODS: Absolutely NO deep-fried items (puri, bhature, pakoras, samosas, vadas, fried snacks, fried cutlets/fish, kachori, bhajiyas).
   - NO HEAVY/OILY GRAVIES: Strictly avoid rich, greasy restaurant/dhaba-style curries with floating oil/ghee, excess butter, or heavy cream (butter chicken, shahi paneer, malai kofta).
   - PREFERRED PREPARATIONS: Prioritize boiled, steamed, dry-roasted, grilled, tandoori, or lightly sautéed foods (e.g. steamed idli/dhokla, boiled kala chana/rajma, roasted makhana/chana, tandoori chicken, grilled paneer, dal with light tadka, fresh salads).
   - COOKING OIL CAP: Max 1 teaspoon (5g) of added oil/ghee per meal for light tempering or pan brushing. Dietary fats must come from natural whole ingredients (curd, seeds, nuts, paneer, eggs), not free cooking oil.
3. If diet_type is "non_veg": You MUST feature non-vegetarian protein sources (e.g. Chicken, Eggs, Fish, Mutton) in at least 2 out of the 4 meals per plan.
4. If diet_type is "vegan": STRICTLY 100% plant-based! NO dairy (milk, paneer, curd, ghee), NO eggs, NO meat, NO fish, NO honey. Use Kala Chana, Rajma, Moong Sprouts, Sattu (Roasted Chana Flour), Besan (Chickpea Flour Chilla), Tofu, Lentils/Dals (Masoor, Toor, Chana Dal), Roasted Peanuts, Oats, and Soya Chunks (max once/day).
5. If diet_type is "veg": STRICTLY Vegetarian! NO meat, NO chicken, NO fish, NO eggs. Use Paneer, Curd/Dahi, Chaach, Kala Chana, Rajma, Moong Sprouts, Sattu, Besan Chilla, Dals, Milk, Peanuts, and Soya Chunks (max once/day).
6. If diet_type is "eggetarian": Vegetarian + Eggs. MUST include egg dishes (Egg Bhurji, Boiled Eggs, Omelettes, Egg Curry) alongside vegetarian staples. NO meat or fish.

FITNESS GOAL RULES:
- "fat_loss": Prioritize high protein density (>2.0g/kg), low refined sugars, and high-fiber vegetables for satiety during deficit.
- "weight_loss": Moderate caloric deficit with balanced whole foods and portion control.
- "muscle_building": Caloric surplus with high protein and complex carbohydrates (oats, brown rice, whole wheat rotis) for workout performance and recovery.
- "muscle_maintain": Balanced maintenance macros and steady energy.

BUDGET TIER RULES:
- "low_budget": Use diverse, highly affordable local market staples (Kala Chana, Rajma, Moong Sprouts, Besan Chilla, Sattu, Dahi/Chaach, Eggs, Masoor/Toor Dal, Roasted Peanuts, Seasonal Veggies, Rice, Wheat Rotis). Do NOT rely heavily on Soya Chunks. Estimated cost: ~₹100-140/day.
- "moderate": Use balanced everyday staples (Paneer, Eggs, Local Chicken, Oats, Milk, Curd, Tofu, Dals). Estimated cost: ~₹180-250/day.
- "flexible": Premium options allowed (Whey Protein, Fish/Salmon, Avocados, Nuts, Greek Yogurt). Estimated cost: ~₹300+/day.

LANGUAGE & BREVITY RULES (CRITICAL):
- Use direct, human, crisp language. ZERO robotic fluff or filler words.
- GOAL ALIGNMENT IN TAGLINES (CRITICAL): The tagline of EVERY plan MUST explicitly match and support the user's exact fitness goal ({goal_type}). For "muscle_building", the tagline MUST emphasize muscle building, lean mass, hypertrophy, or surplus recovery (e.g. "High-protein surplus plan tailored for muscle building & hypertrophy"). NEVER mention maintenance or maintenance journey. For "fat_loss"/"weight_loss", MUST emphasize fat loss, deficit, and retention.
- dish_name: MUST be exactly 2 to 3 words only (e.g., "Paneer Bhurji Toast", "Dal Tadka Rice", "Egg Bhurji Roti", "Chicken Quinoa Bowl", "Sprouted Moong Salad"). NO long compound names.
- Tagline: Max 8-10 words. Simple reason why it works matching the user's specific goal.
- ingredients: Array of 3 to 5 bullet items. Each item MUST include its exact quantity, food item name, and individual calorie & macronutrient breakdown in brackets formatted exactly as: "<Quantity> <Item name> (<calories> kcal • P: <protein>g, C: <carbs>g, F: <fat>g)" (e.g. ["100g low-fat paneer (170 kcal • P: 18g, C: 3g, F: 4g)", "2 whole wheat rotis (160 kcal • P: 6g, C: 30g, F: 1g)", "1 tsp olive oil (45 kcal • F: 5g)"]).
- description: Single short prep sentence under 12 words (e.g. "Sauté paneer with spices and serve warm with rotis.").

CARD PRIORITIZATION & TIMING BADGE RULES (CRITICAL):
1. priority: Every meal item MUST include a "priority" field with one of:
   - "high": Assigned to primary recovery/anchor meals (e.g. post-workout meal with highest protein density or main anchor meal).
   - "medium": Assigned to balanced everyday staples (e.g. standard wholesome lunch or dinner providing steady energy).
   - "low": Assigned to snacks or light supplementary meals.
2. timing_badge: Every meal item MUST include a concise 2 to 3 word badge:
   - Post-workout recovery meals: "Post-Workout Recovery"
   - Pre-workout meals or snacks: "Pre-Workout Fuel"
   - Daytime energy meals: "Sustained Energy"
   - Light evening replenishment: "Overnight Repair"
   - Circadian breakfast: "Morning Kickstart"

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
          "priority": "high",
          "timing_badge": "Post-Workout Recovery",
          "ingredients": [
            "100g low-fat paneer (170 kcal • P: 18g, C: 3g, F: 4g)",
            "2 brown bread slices (150 kcal • P: 8g, C: 28g, F: 2g)",
            "1 tsp olive oil (45 kcal • F: 5g)"
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
          "priority": "medium",
          "timing_badge": "Sustained Energy",
          "ingredients": [
            "1 bowl toor dal (180 kcal • P: 14g, C: 28g, F: 2g)",
            "1 cup cooked rice (210 kcal • P: 4g, C: 45g, F: 1g)",
            "1 cucumber salad (20 kcal • P: 1g, C: 4g, F: 0g)"
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
          "priority": "low",
          "timing_badge": "Pre-Workout Fuel",
          "ingredients": [
            "1 cup boiled sprouts (150 kcal • P: 14g, C: 24g, F: 1g)",
            "15g roasted peanuts (85 kcal • P: 4g, C: 3g, F: 7g)",
            "Chopped tomatoes & lemon (15 kcal • P: 1g, C: 4g, F: 0g)"
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
          "priority": "medium",
          "timing_badge": "Overnight Repair",
          "ingredients": [
            "40g soya chunks (140 kcal • P: 21g, C: 13g, F: 0.5g)",
            "2 wheat rotis (160 kcal • P: 6g, C: 30g, F: 1g)",
            "Tomato onion gravy (50 kcal • P: 2g, C: 6g, F: 3g)"
          ],
          "description": "Simmer boiled soya in light curry and serve with rotis."
        }}
      ]
    }}
  ]
}}
"""


def _get_fallback_meal_recommendations(
    goal_type: str = "fat_loss",
    diet_type: str = "veg",
    budget_tier: str = "moderate",
    calorie_goal: int = 2000,
) -> dict:
    """Generate balanced static fallback meal recommendations if Gemini fails or times out."""
    is_non_veg = diet_type in ("non_veg", "eggetarian")
    is_vegan = diet_type == "vegan"

    b_dish = (
        "Spiced Tofu Scramble with Oats"
        if is_vegan
        else ("Egg Bhurji & Multigrain Toast" if is_non_veg else "Paneer Bhurji & Multigrain Toast")
    )
    l_dish = (
        "Chickpea & Steamed Brown Rice Bowl"
        if is_vegan
        else (
            "Grilled Chicken Breast & Quinoa Thali"
            if diet_type == "non_veg"
            else "High-Protein Chana Dal & Brown Rice Thali"
        )
    )
    s_dish = (
        "Roasted Chana & Mixed Seeds"
        if is_vegan
        else ("Boiled Eggs & Roasted Chana" if is_non_veg else "Greek Yogurt / Hung Curd & Roasted Almonds")
    )
    d_dish = (
        "Yellow Dal Tadka & Steamed Vegetables"
        if is_vegan
        else (
            "Grilled Fish / Chicken with Sauteed Veggies"
            if diet_type == "non_veg"
            else "Low-Oil Paneer Tikka with Sautéed Veggies & Phulka"
        )
    )

    return {
        "budget_tier": budget_tier,
        "diet_type": diet_type,
        "recommendations": [
            {
                "dish_name": b_dish,
                "meal_type": "Breakfast",
                "estimated_cost": "Budget Friendly (~₹50-70 per serving)",
                "calories": round(calorie_goal * 0.25),
                "protein": 22.0,
                "carbs": 35.0,
                "fat": 8.0,
                "description": f"High-protein balanced breakfast matched to your {diet_type} diet.",
                "recipe_summary": "Cook in a non-stick pan with 1 tsp oil/ghee. Add turmeric, onions, and green chilies. Serve warm.",
            },
            {
                "dish_name": l_dish,
                "meal_type": "Lunch",
                "estimated_cost": "Moderate (~₹70-100 per serving)",
                "calories": round(calorie_goal * 0.35),
                "protein": 32.0,
                "carbs": 60.0,
                "fat": 10.0,
                "description": "Wholesome midday meal packed with complex carbs and lean protein.",
                "recipe_summary": "Steam grains and simmer protein curry with minimal oil tadka and fresh coriander.",
            },
            {
                "dish_name": s_dish,
                "meal_type": "Snack",
                "estimated_cost": "Pocket Friendly (~₹30-40 per serving)",
                "calories": round(calorie_goal * 0.15),
                "protein": 14.0,
                "carbs": 20.0,
                "fat": 5.0,
                "description": "Quick clean protein snack to sustain afternoon energy.",
                "recipe_summary": "Dry roast in pan or consume fresh with light rock salt seasoning.",
            },
            {
                "dish_name": d_dish,
                "meal_type": "Dinner",
                "estimated_cost": "Moderate (~₹60-90 per serving)",
                "calories": round(calorie_goal * 0.25),
                "protein": 26.0,
                "carbs": 40.0,
                "fat": 7.0,
                "description": "Light, easily digestible recovery dinner with lean protein.",
                "recipe_summary": "Grill or lightly sauté with seasonal vegetables and mild spices.",
            },
        ],
    }


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
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            ),
            timeout=10.0,
        )
        duration = time.perf_counter() - t_start
        logger.info(f"Gemini API call (recommend_curated_meals) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")
        return _parse_json_from_text(response.text)
    except (asyncio.TimeoutError, TimeoutError) as e:
        duration = time.perf_counter() - t_start
        logger.warning(f"Standard JSON meal generation timed out after {duration:.2f}s, returning static fallback: {e}")
        return _get_fallback_meal_recommendations(goal_type, diet_type, budget_tier, calorie_goal)
    except Exception as e:
        duration = time.perf_counter() - t_start
        logger.warning(f"Standard JSON meal generation failed after {duration:.2f}s, attempting grounded search: {e}")

    # Second attempt: Grounded search without response_mime_type (unsupported together by Gemini API)
    t_search_start = time.perf_counter()
    try:
        search_tool = types.Tool(google_search=types.GoogleSearch())
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[search_tool],
                    temperature=0.4,
                ),
            ),
            timeout=10.0,
        )
        duration = time.perf_counter() - t_search_start
        logger.info(f"Gemini API call with search (recommend_curated_meals) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")
        return _parse_json_from_text(response.text)
    except Exception as err:
        duration = time.perf_counter() - t_search_start
        logger.error(f"Failed to generate meal recommendations after {duration:.2f}s: {err}. Returning static fallback.")
        return _get_fallback_meal_recommendations(goal_type, diet_type, budget_tier, calorie_goal)


def _get_fallback_meal_plans(
    goal_type: str = "fat_loss",
    diet_type: str = "veg",
    budget_tier: str = "moderate",
    workout_time: str = "evening",
    calorie_goal: int = 2000,
    protein_goal: int = 150,
    carbs_goal: int = 200,
    fat_goal: int = 65,
) -> dict:
    """Generate balanced static fallback meal plan options if Gemini fails or times out."""
    budget_cost_map = {
        "low_budget": "₹100-140/day",
        "moderate": "₹180-250/day",
        "flexible": "₹300+/day",
    }
    cost = budget_cost_map.get(budget_tier, "₹180-250/day")

    goal_taglines = {
        "muscle_building": "High-protein surplus plan designed for muscle building and lean hypertrophy.",
        "fat_loss": "Protein-dense deficit plan designed for fat loss and muscle retention.",
        "weight_loss": "Calorie-controlled plan designed for steady and healthy weight loss.",
        "muscle_maintain": "Balanced nutrition plan designed for muscle maintenance and steady energy.",
    }
    tagline = goal_taglines.get(goal_type, "Balanced macro plan designed for your fitness goal.")

    is_non_veg = diet_type in ("non_veg", "eggetarian")
    is_vegan = diet_type == "vegan"

    b_dish = (
        "Spiced Tofu Scramble with Oats"
        if is_vegan
        else ("Classic Egg Bhurji & Multigrain Toast" if is_non_veg else "Paneer Bhurji & Multigrain Phulkas")
    )
    l_dish = (
        "Chickpea Curry & Steamed Brown Rice"
        if is_vegan
        else (
            "Grilled Chicken Breast & Dal Khichdi"
            if diet_type == "non_veg"
            else "High-Protein Dal Tadka & Jeera Rice Thali"
        )
    )
    s_dish = (
        "Roasted Chana & Mixed Pumpkin Seeds"
        if is_vegan
        else ("Boiled Eggs with Himalayan Pink Salt" if is_non_veg else "Sprouted Moong Salad with Lemon")
    )
    d_dish = (
        "Soya Chunks & Vegetable Stir-Fry"
        if is_vegan
        else (
            "Tandoori Chicken / Fish with Steamed Veggies"
            if diet_type == "non_veg"
            else "Low-Fat Paneer Curry with 2 Wheat Rotis"
        )
    )

    meals_plan_1 = [
        {
            "meal_type": "Breakfast",
            "dish_name": b_dish,
            "calories": round(calorie_goal * 0.25),
            "protein": round(protein_goal * 0.25, 1),
            "carbs": round(carbs_goal * 0.25, 1),
            "fat": round(fat_goal * 0.25, 1),
            "priority": "high" if workout_time == "morning" else "medium",
            "timing_badge": "Post-Workout Recovery" if workout_time == "morning" else "Sustained Energy",
            "ingredients": ["Clean wholesome protein source", "Whole grains", "Light seasoning"],
            "description": "High-protein morning meal to kickstart metabolism and muscle synthesis.",
        },
        {
            "meal_type": "Lunch",
            "dish_name": l_dish,
            "calories": round(calorie_goal * 0.35),
            "protein": round(protein_goal * 0.35, 1),
            "carbs": round(carbs_goal * 0.35, 1),
            "fat": round(fat_goal * 0.35, 1),
            "priority": "high" if workout_time == "afternoon" else "medium",
            "timing_badge": "Post-Workout Recovery" if workout_time == "afternoon" else "Sustained Energy",
            "ingredients": ["Lentils/Legumes or Lean meat", "Complex carbohydrates", "Fresh green salad"],
            "description": "Nutrient-dense lunch delivering steady sustained glucose and amino acids.",
        },
        {
            "meal_type": "Snack",
            "dish_name": s_dish,
            "calories": round(calorie_goal * 0.15),
            "protein": round(protein_goal * 0.15, 1),
            "carbs": round(carbs_goal * 0.15, 1),
            "fat": round(fat_goal * 0.15, 1),
            "priority": "low",
            "timing_badge": "Pre-Workout Fuel" if workout_time == "evening" else "Metabolic Snack",
            "ingredients": ["Nutrient-rich whole snack", "Minimal seasoning"],
            "description": "Quick clean protein booster to prevent afternoon energy dips.",
        },
        {
            "meal_type": "Dinner",
            "dish_name": d_dish,
            "calories": round(calorie_goal * 0.25),
            "protein": round(protein_goal * 0.25, 1),
            "carbs": round(carbs_goal * 0.25, 1),
            "fat": round(fat_goal * 0.25, 1),
            "priority": "high" if workout_time == "evening" else "medium",
            "timing_badge": "Post-Workout Recovery" if workout_time == "evening" else "Overnight Repair",
            "ingredients": ["Clean lean protein", "Fiber-rich vegetables", "Light healthy fats"],
            "description": "Easy to digest, recovery-focused dinner supporting overnight muscle repair.",
        },
    ]

    plan_1 = {
        "plan_id": "essential-balanced-1",
        "plan_name": "Core Balanced Protocol",
        "tagline": tagline,
        "estimated_cost": cost,
        "total_calories": calorie_goal,
        "total_protein": float(protein_goal),
        "total_carbs": float(carbs_goal),
        "total_fat": float(fat_goal),
        "meals": meals_plan_1,
    }

    plan_2 = {
        "plan_id": "performance-density-2",
        "plan_name": "High-Efficiency Recovery",
        "tagline": f"Targeted macro distribution for {goal_type.replace('_', ' ')}.",
        "estimated_cost": cost,
        "total_calories": calorie_goal,
        "total_protein": float(protein_goal),
        "total_carbs": float(carbs_goal),
        "total_fat": float(fat_goal),
        "meals": meals_plan_1,
    }

    plan_3 = {
        "plan_id": "quick-prep-staples-3",
        "plan_name": "Simple Kitchen Staples",
        "tagline": "Simple everyday ingredients requiring under 20 minutes prep time.",
        "estimated_cost": cost,
        "total_calories": calorie_goal,
        "total_protein": float(protein_goal),
        "total_carbs": float(carbs_goal),
        "total_fat": float(fat_goal),
        "meals": meals_plan_1,
    }

    return {"plans": [plan_1, plan_2, plan_3]}


async def generate_multiple_meal_plans(
    goal_type: str = "fat_loss",
    diet_type: str = "veg",
    budget_tier: str = "moderate",
    workout_time: str = "evening",
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

    workout_descriptions = {
        "morning": "Morning Workout (6 AM – 9 AM): Breakfast is the primary Post-Workout Recovery meal",
        "afternoon": "Midday Workout (12 PM – 3 PM): Lunch is the primary Post-Workout Recovery meal",
        "evening": "Evening Workout (5 PM – 8 PM): Snack is Pre-Workout Fuel, Dinner is Post-Workout Recovery",
        "night": "Night Workout (8 PM – 10 PM): Light pre-workout dinner, clean post-workout protein replenishment",
        "none": "No Structured Workout / Rest Days: Evenly distributed circadian nutrition",
    }

    prompt = MULTIPLE_MEAL_PLANS_PROMPT.format(
        goal_type=goal_descriptions.get(goal_type, goal_type),
        diet_type=diet_descriptions.get(diet_type, diet_type),
        budget_tier=budget_descriptions.get(budget_tier, budget_tier),
        workout_timing_desc=workout_descriptions.get(workout_time, workout_descriptions["evening"]),
        calorie_goal=calorie_goal,
        protein_goal=protein_goal,
        carbs_goal=carbs_goal,
        fat_goal=fat_goal
    )

    t_start = time.perf_counter()
    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.4,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            ),
            timeout=10.0,
        )
        duration = time.perf_counter() - t_start
        logger.info(f"Gemini API call (generate_multiple_meal_plans) completed in {duration:.2f}s ({duration * 1000:.0f}ms)")
        data = _parse_json_from_text(response.text)

        # Standardize budget numbers everywhere to one consistent format
        budget_cost_map = {
            "low_budget": "₹100-140/day",
            "moderate": "₹180-250/day",
            "flexible": "₹300+/day",
        }
        standard_cost = budget_cost_map.get(budget_tier, "₹100-140/day")

        # Guarantee goal vs plan description strictly matches
        goal_fallback_taglines = {
            "muscle_building": "High-protein surplus plan designed for muscle building and lean hypertrophy.",
            "fat_loss": "Protein-dense deficit plan designed for fat loss and muscle retention.",
            "weight_loss": "Calorie-controlled plan designed for steady and healthy weight loss.",
            "muscle_maintain": "Balanced nutrition plan designed for muscle maintenance and steady energy.",
        }

        for plan in data.get("plans", []):
            plan["estimated_cost"] = standard_cost
            tagline = plan.get("tagline", "")
            # Ensure goal matches tagline and never mentions maintenance for muscle building
            if goal_type == "muscle_building":
                if not tagline or any(bad in tagline.lower() for bad in ["maintain", "maintenance", "deficit", "fat loss", "weight loss"]):
                    plan["tagline"] = goal_fallback_taglines["muscle_building"]
            elif goal_type in ("fat_loss", "weight_loss"):
                if not tagline or any(bad in tagline.lower() for bad in ["surplus", "bulk", "hypertrophy"]):
                    plan["tagline"] = goal_fallback_taglines[goal_type]
            elif not tagline:
                plan["tagline"] = goal_fallback_taglines.get(goal_type, "Tailored specifically to hit your daily macro targets.")

            # Ensure every meal in the plan has priority and timing_badge
            for m in plan.get("meals", []):
                m_type = str(m.get("meal_type", "")).strip().lower()
                if not m.get("priority"):
                    if m_type == "snack":
                        m["priority"] = "low"
                    elif (workout_time == "morning" and m_type == "breakfast") or \
                         (workout_time == "afternoon" and m_type == "lunch") or \
                         (workout_time == "evening" and m_type == "dinner"):
                        m["priority"] = "high"
                    else:
                        m["priority"] = "medium"

                if not m.get("timing_badge"):
                    if m_type == "snack":
                        m["timing_badge"] = "Pre-Workout Fuel" if workout_time == "evening" else "Metabolic Snack"
                    elif (workout_time == "morning" and m_type == "breakfast") or \
                         (workout_time == "afternoon" and m_type == "lunch") or \
                         (workout_time == "evening" and m_type == "dinner"):
                        m["timing_badge"] = "Post-Workout Recovery"
                    else:
                        m["timing_badge"] = "Sustained Energy"

        return data
    except Exception as e:
        duration = time.perf_counter() - t_start
        logger.error(f"Failed to generate multiple meal plans after {duration:.2f}s: {e}. Returning static fallback plans.")
        return _get_fallback_meal_plans(
            goal_type=goal_type,
            diet_type=diet_type,
            budget_tier=budget_tier,
            workout_time=workout_time,
            calorie_goal=calorie_goal,
            protein_goal=protein_goal,
            carbs_goal=carbs_goal,
            fat_goal=fat_goal,
        )


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
    goal_type: str = "fat_loss",
    diet_type: str = "veg",
    calorie_goal: int = 2000,
    protein_goal: int = 150,
    carbs_goal: int = 200,
    fat_goal: int = 65,
    yesterday_calories: int = 0,
    yesterday_protein: float = 0.0,
    yesterday_carbs: float = 0.0,
    yesterday_fat: float = 0.0,
    yesterday_meal_count: int = 0,
    yesterday_meals: list[dict] | None = None,
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
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            ),
            timeout=10.0,
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




