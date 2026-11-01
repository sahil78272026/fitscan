import json
import logging
import math
from datetime import date, datetime, timezone, timedelta
from sqlalchemy import select, func, distinct, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.meal import Meal, FoodItem
from app.models.settings import UserSettings
from app.services.gemini_service import analyze_food
from app.services.redis_service import cache_get, cache_set, cache_delete

logger = logging.getLogger("corecontrol.meal_service")


async def create_meal(
    db: AsyncSession,
    user_id: int,
    raw_input: str,
    meal_type: str,
    target_meal_date: date | None = None,
    image_bytes: bytes | None = None,
    mime_type: str = "image/jpeg",
    image_url: str | None = None
) -> Meal:
    """Analyze food with Gemini (text and/or image) and store the meal + food items with macro segregation."""

    # Get calorie & macro breakdown from Gemini
    analysis = await analyze_food(raw_input=raw_input, image_bytes=image_bytes, mime_type=mime_type)

    # Create meal
    meal = Meal(
        user_id=user_id,
        meal_type=meal_type,
        raw_input=raw_input or "Scanned Meal",
        total_calories=analysis["total_calories"],
        total_protein=analysis["total_protein"],
        total_carbs=analysis["total_carbs"],
        total_fat=analysis["total_fat"],
        image_url=image_url,
        meal_date=target_meal_date or date.today(),
    )
    db.add(meal)
    await db.flush()  # get meal.id

    # Create food items
    for item_data in analysis.get("items", []):
        food_item = FoodItem(
            meal_id=meal.id,
            name=item_data["name"],
            quantity=item_data.get("quantity", 1.0),
            unit=item_data.get("unit", "serving"),
            calories=item_data.get("calories", 0),
            protein=item_data.get("protein", 0.0),
            carbs=item_data.get("carbs", 0.0),
            fat=item_data.get("fat", 0.0),
        )
        db.add(food_item)

    await db.commit()
    await db.refresh(meal, attribute_names=["food_items"])

    logger.info(f"Created meal #{meal.id} for user #{user_id}: {meal_type} — {meal.total_calories} kcal (P:{meal.total_protein}g, C:{meal.total_carbs}g, F:{meal.total_fat}g)")

    # Invalidate Redis cache for user daily summary, calendar, and adherence
    try:
        date_str = meal.meal_date.isoformat()
        await cache_delete(
            f"user:{user_id}:daily_summary:{date_str}",
            f"user:{user_id}:recent_items",
            f"user:{user_id}:calendar:{meal.meal_date.year}:{meal.meal_date.month}",
            f"user:{user_id}:stats:adherence",
        )
    except Exception as exc:
        logger.warning(f"Cache invalidation on create_meal failed: {exc}")

    return meal


async def get_meals_by_date(db: AsyncSession, user_id: int, target_date: date) -> list[Meal]:
    """Get all meals for a specific date with food items eagerly loaded."""
    result = await db.execute(
        select(Meal)
        .where(Meal.user_id == user_id, Meal.meal_date == target_date)
        .options(selectinload(Meal.food_items))
        .order_by(Meal.logged_at.desc())
    )
    return list(result.scalars().all())


async def delete_meal(db: AsyncSession, user_id: int, meal_id: int) -> bool:
    """Delete a meal by ID (only if owned by user). Returns True if deleted, False if not found."""
    result = await db.execute(
        select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id)
    )
    meal = result.scalar_one_or_none()
    if not meal:
        return False

    meal_date = meal.meal_date
    await db.delete(meal)
    await db.commit()
    logger.info(f"Deleted meal #{meal_id} for user #{user_id}")

    # Invalidate Redis cache for user daily summary, calendar, and adherence
    try:
        date_str = meal_date.isoformat()
        await cache_delete(
            f"user:{user_id}:daily_summary:{date_str}",
            f"user:{user_id}:recent_items",
            f"user:{user_id}:calendar:{meal_date.year}:{meal_date.month}",
            f"user:{user_id}:stats:adherence",
        )
    except Exception as exc:
        logger.warning(f"Cache invalidation on delete_meal failed: {exc}")

    return True


async def update_meal(
    db: AsyncSession,
    user_id: int,
    meal_id: int,
    meal_type: str | None = None,
    raw_input: str | None = None,
    meal_date: date | None = None,
    image_url: str | None = None,
) -> Meal | None:
    """
    Update / reclassify a logged meal's meal_type, raw_input, meal_date, or image_url.
    Eagerly loads food_items to satisfy MealResponse schema serialization.
    Invalidates Redis summary, recent items, calendar, and adherence caches across all affected dates.
    Returns the updated Meal instance, or None if not found or unauthorized.
    """
    result = await db.execute(
        select(Meal)
        .where(Meal.id == meal_id, Meal.user_id == user_id)
        .options(selectinload(Meal.food_items))
    )
    meal = result.scalar_one_or_none()
    if not meal:
        return None

    old_date = meal.meal_date

    if meal_type is not None:
        meal.meal_type = meal_type
    if raw_input is not None:
        cleaned_raw = raw_input.strip()
        if not cleaned_raw:
            raise ValueError("raw_input cannot be empty")
        if cleaned_raw != meal.raw_input:
            meal.raw_input = cleaned_raw
            analysis = await analyze_food(raw_input=meal.raw_input)
            meal.total_calories = int(analysis.get("total_calories", 0))
            meal.total_protein = round(float(analysis.get("total_protein", 0.0)), 1)
            meal.total_carbs = round(float(analysis.get("total_carbs", 0.0)), 1)
            meal.total_fat = round(float(analysis.get("total_fat", 0.0)), 1)

            meal.food_items.clear()
            for item_data in analysis.get("items", []):
                food_item = FoodItem(
                    meal_id=meal.id,
                    name=item_data["name"],
                    quantity=float(item_data.get("quantity", 1.0)),
                    unit=item_data.get("unit", "serving"),
                    calories=int(item_data.get("calories", 0)),
                    protein=float(item_data.get("protein", 0.0)),
                    carbs=float(item_data.get("carbs", 0.0)),
                    fat=float(item_data.get("fat", 0.0)),
                )
                meal.food_items.append(food_item)
                db.add(food_item)
    if meal_date is not None:
        meal.meal_date = meal_date
    if image_url is not None:
        meal.image_url = image_url

    await db.commit()
    await db.refresh(meal, attribute_names=["food_items"])

    logger.info(
        f"Updated meal #{meal.id} for user #{user_id}: "
        f"type={meal.meal_type}, date={meal.meal_date}, raw_input={meal.raw_input}"
    )

    # Invalidate Redis cache for user daily summary, calendar, and adherence
    try:
        keys_to_delete = [
            f"user:{user_id}:daily_summary:{old_date.isoformat()}",
            f"user:{user_id}:recent_items",
            f"user:{user_id}:calendar:{old_date.year}:{old_date.month}",
            f"user:{user_id}:stats:adherence",
        ]
        if meal.meal_date != old_date:
            keys_to_delete.extend([
                f"user:{user_id}:daily_summary:{meal.meal_date.isoformat()}",
                f"user:{user_id}:calendar:{meal.meal_date.year}:{meal.meal_date.month}",
            ])
        await cache_delete(*keys_to_delete)
    except Exception as exc:
        logger.warning(f"Cache invalidation on update_meal failed: {exc}")

    return meal


async def get_recent_food_items(db: AsyncSession, user_id: int, limit: int = 15) -> list[dict]:
    """
    Get deduplicated recent food items from the user's last 5 meal sessions.
    Returns a list of unique food item dicts (name, quantity, unit, calories, protein, carbs, fat, meal_type)
    ordered by most recently eaten, capped at `limit`.
    """
    # Get the last 5 distinct meal dates for this user
    recent_dates_result = await db.execute(
        select(Meal.meal_date)
        .where(Meal.user_id == user_id)
        .group_by(Meal.meal_date)
        .order_by(desc(Meal.meal_date))
        .limit(5)
    )
    recent_dates = [row[0] for row in recent_dates_result.all()]

    if not recent_dates:
        return []

    # Get all food items with their parent meal's meal_type, ordered by most recent
    result = await db.execute(
        select(FoodItem, Meal.meal_type)
        .join(Meal, FoodItem.meal_id == Meal.id)
        .where(Meal.user_id == user_id, Meal.meal_date.in_(recent_dates))
        .order_by(desc(Meal.logged_at))
    )
    rows = result.all()

    # Deduplicate by (lowercase name + meal_type), keeping the most recent occurrence
    seen_keys = set()
    unique_items = []
    for item, meal_type in rows:
        name_key = (item.name.strip().lower(), meal_type)
        if name_key not in seen_keys:
            seen_keys.add(name_key)
            unique_items.append({
                "name": item.name,
                "quantity": item.quantity,
                "unit": item.unit,
                "calories": item.calories,
                "protein": item.protein,
                "carbs": item.carbs,
                "fat": item.fat,
                "meal_type": meal_type,
            })
        if len(unique_items) >= limit:
            break

    return unique_items


async def get_daily_summary(db: AsyncSession, user_id: int, target_date: date | None = None) -> dict:
    """Get summary for a specific date: total calories & macros, goals, remaining values, meals, and recent food suggestions."""
    if target_date is None:
        target_date = date.today()

    date_str = target_date.isoformat()
    cache_key = f"user:{user_id}:daily_summary:{date_str}"

    # 1. Try reading from Upstash Redis (Cache-aside)
    try:
        cached = await cache_get(cache_key)
        if cached and isinstance(cached, dict):
            logger.info(f"Upstash cache HIT for {cache_key}")
            return cached
    except Exception as exc:
        logger.warning(f"Failed to read daily_summary cache for {cache_key}: {exc}")

    logger.info(f"Upstash cache MISS for {cache_key} — querying DB")

    # 2. Cache Miss: Execute DB queries
    meals = await get_meals_by_date(db, user_id, target_date)
    recent_items = await get_recent_food_items(db, user_id)

    # Calculate totals
    total_calories = sum(m.total_calories for m in meals)
    total_protein = round(sum(m.total_protein for m in meals), 1)
    total_carbs = round(sum(m.total_carbs for m in meals), 1)
    total_fat = round(sum(m.total_fat for m in meals), 1)

    # Get settings
    settings = await get_or_create_settings(db, user_id)

    # Serialize meals and food items so the dict is directly cacheable and JSON-serializable
    serialized_meals = []
    for m in meals:
        serialized_meals.append({
            "id": m.id,
            "meal_type": m.meal_type,
            "raw_input": m.raw_input,
            "total_calories": m.total_calories,
            "total_protein": m.total_protein,
            "total_carbs": m.total_carbs,
            "total_fat": m.total_fat,
            "image_url": m.image_url,
            "meal_date": m.meal_date.isoformat() if hasattr(m.meal_date, "isoformat") else str(m.meal_date),
            "logged_at": m.logged_at.isoformat() if m.logged_at else datetime.now(timezone.utc).isoformat(),
            "food_items": [
                {
                    "id": item.id,
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "calories": item.calories,
                    "protein": item.protein,
                    "carbs": item.carbs,
                    "fat": item.fat,
                }
                for item in (m.food_items or [])
            ],
        })

    summary_data = {
        "date": date_str,
        "total_calories": total_calories,
        "total_protein": total_protein,
        "total_carbs": total_carbs,
        "total_fat": total_fat,
        "calorie_goal": settings.calorie_goal,
        "protein_goal": settings.protein_goal,
        "carbs_goal": settings.carbs_goal,
        "fat_goal": settings.fat_goal,
        "remaining_calories": max(0, settings.calorie_goal - total_calories),
        "remaining_protein": max(0.0, round(settings.protein_goal - total_protein, 1)),
        "remaining_carbs": max(0.0, round(settings.carbs_goal - total_carbs, 1)),
        "remaining_fat": max(0.0, round(settings.fat_goal - total_fat, 1)),
        "meal_count": len(meals),
        "meals": serialized_meals,
        "recent_items": recent_items,
    }

    # 3. Store in Upstash Redis
    # Past dates are immutable -> 7 days TTL (604800s); Today is dynamic -> 15 min TTL (900s)
    try:
        ttl = 604800 if target_date < date.today() else 900
        await cache_set(cache_key, summary_data, ex=ttl)
    except Exception as exc:
        logger.warning(f"Failed to set daily_summary cache for {cache_key}: {exc}")

    return summary_data


async def get_or_create_settings(db: AsyncSession, user_id: int) -> UserSettings:
    """Get current settings for user or create default, safely handling concurrent requests."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        try:
            settings = UserSettings(
                user_id=user_id,
                calorie_goal=2000,
                protein_goal=150,
                carbs_goal=200,
                fat_goal=65,
                goal_type="fat_loss",
                diet_type="veg",
                budget_tier="moderate",
                activity_level="moderate"
            )
            db.add(settings)
            await db.commit()
            await db.refresh(settings)
        except IntegrityError:
            await db.rollback()
            result = await db.execute(
                select(UserSettings).where(UserSettings.user_id == user_id)
            )
            settings = result.scalar_one_or_none()

    return settings


def get_plan_change_availability(settings: UserSettings) -> tuple[bool, int, int]:
    """
    Check if the user is allowed to change/rotate their meal plan.
    - Rate limit: 1 change per rolling 24 hours (first-time onboarding is always allowed).
    Returns: (can_change: bool, hours_until_next_change: int, days_until_next_change: int)
    """
    tier = (getattr(settings, "subscription_tier", "free") or "free").lower()
    if tier == "pro":
        return True, 0, 0

    last_change = getattr(settings, "last_plan_change_at", None)
    selected_plan = getattr(settings, "selected_meal_plan", None)

    # First time user or no active meal plan chosen yet -> allow change
    if not last_change or not selected_plan:
        return True, 0, 0

    if last_change.tzinfo is None:
        last_change = last_change.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    elapsed = now - last_change
    cooldown = timedelta(hours=24)

    if elapsed >= cooldown:
        return True, 0, 0

    remaining_seconds = (cooldown - elapsed).total_seconds()
    hours_left = max(1, math.ceil(remaining_seconds / 3600))
    days_left = max(1, math.ceil(remaining_seconds / 86400))
    return False, hours_left, days_left


def parse_settings_response_dict(settings: UserSettings) -> dict:
    """Helper to convert UserSettings to dict with parsed selected_meal_plan and subscription status."""
    selected_plan = None
    if settings.selected_meal_plan:
        if isinstance(settings.selected_meal_plan, str):
            try:
                selected_plan = json.loads(settings.selected_meal_plan)
            except Exception:
                selected_plan = None
        elif isinstance(settings.selected_meal_plan, dict):
            selected_plan = settings.selected_meal_plan

        if isinstance(selected_plan, dict) and "meals" in selected_plan:
            for meal in selected_plan.get("meals", []):
                if isinstance(meal, dict):
                    m_type = str(meal.get("meal_type", "")).strip().lower()
                    if not meal.get("priority"):
                        meal["priority"] = "low" if m_type == "snack" else "medium"
                    if not meal.get("timing_badge"):
                        meal["timing_badge"] = "Pre-Workout Fuel" if m_type == "snack" else "Sustained Energy"

    can_change, hours_left, days_left = get_plan_change_availability(settings)

    return {
        "calorie_goal": settings.calorie_goal,
        "protein_goal": settings.protein_goal,
        "carbs_goal": settings.carbs_goal,
        "fat_goal": settings.fat_goal,
        "goal_type": settings.goal_type,
        "diet_type": settings.diet_type,
        "budget_tier": settings.budget_tier,
        "age": settings.age,
        "gender": settings.gender,
        "height_cm": settings.height_cm,
        "weight_kg": settings.weight_kg,
        "start_weight_kg": settings.start_weight_kg,
        "activity_level": settings.activity_level,
        "workout_time": getattr(settings, "workout_time", "evening") or "evening",
        "selected_meal_plan": selected_plan,
        "subscription_tier": getattr(settings, "subscription_tier", "free") or "free",
        "last_plan_change_at": getattr(settings, "last_plan_change_at", None),
        "can_change_plan": can_change,
        "hours_until_next_plan_change": hours_left,
        "days_until_next_plan_change": days_left,
        "morning_briefing_enabled": bool(getattr(settings, "morning_briefing_enabled", 1) != 0),
        "morning_briefing_start_hour": getattr(settings, "morning_briefing_start_hour", 6) if getattr(settings, "morning_briefing_start_hour", None) is not None else 6,
        "morning_briefing_end_hour": getattr(settings, "morning_briefing_end_hour", 11) if getattr(settings, "morning_briefing_end_hour", None) is not None else 11,
        "morning_briefing_frequency": getattr(settings, "morning_briefing_frequency", "daily") or "daily",
    }


# Activity level multipliers for TDEE calculation
ACTIVITY_MULTIPLIERS: dict[str, float] = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "very_active": 1.725,
}

# Configurable Goal Profiles: calorie multiplier, protein factor (g/kg), and fat allocation (% of calories)
GOAL_PROFILES: dict[str, dict[str, float]] = {
    "fat_loss": {
        "calorie_multiplier": 0.80,   # 20% caloric deficit
        "protein_g_per_kg": 2.2,     # High protein to preserve muscle & increase satiety
        "fat_pct_calories": 0.32,    # 32% calories from healthy fats
    },
    "weight_loss": {
        "calorie_multiplier": 0.85,   # 15% caloric deficit
        "protein_g_per_kg": 2.0,     # Moderate-high protein
        "fat_pct_calories": 0.30,    # 30% calories from healthy fats
    },
    "muscle_building": {
        "calorie_multiplier": 1.12,   # 12% caloric surplus
        "protein_g_per_kg": 2.2,     # High protein for hypertrophy
        "fat_pct_calories": 0.25,    # 25% calories from fat (higher carbs to fuel workouts)
    },
    "muscle_maintain": {
        "calorie_multiplier": 1.00,   # Maintenance calories
        "protein_g_per_kg": 1.8,     # Maintenance protein
        "fat_pct_calories": 0.28,    # 28% calories from fat
    },
}

DEFAULT_GOAL_PROFILE = GOAL_PROFILES["fat_loss"]
DEFAULT_ACTIVITY_MULTIPLIER = ACTIVITY_MULTIPLIERS["moderate"]


def calculate_user_goals(
    goal_type: str = "fat_loss",
    weight_kg: float | None = 70.0,
    height_cm: float | None = 170.0,
    age: int | None = 25,
    gender: str | None = "male",
    activity_level: str | None = "moderate"
) -> tuple[int, int, int, int]:
    """
    Dynamically calculate daily calorie and macro goals (Protein, Carbs, Fat)
    based on Mifflin-St Jeor BMR, TDEE, activity level, and goal profile.
    Safely handles extreme weights, null gender, missing activity level, and ensures macro congruency.
    Returns: (calorie_goal, protein_goal, carbs_goal, fat_goal)
    """
    # 1. Biological Boundary Clamping
    try:
        w = max(30.0, min(float(weight_kg), 250.0)) if weight_kg is not None else 70.0
    except (ValueError, TypeError):
        w = 70.0

    try:
        h = max(100.0, min(float(height_cm), 250.0)) if height_cm is not None else 170.0
    except (ValueError, TypeError):
        h = 170.0

    try:
        a = max(12, min(int(age), 100)) if age is not None else 25
    except (ValueError, TypeError):
        a = 25

    # 2. Gender Neutrality & Mifflin-St Jeor
    g_clean = str(gender).strip().lower() if gender else "neutral"
    if g_clean in ("female", "woman", "f"):
        gender_offset = -161
    elif g_clean in ("male", "man", "m"):
        gender_offset = 5
    else:
        # Non-binary, other, or unspecified: neutral midpoint between male (+5) and female (-161)
        gender_offset = -78

    bmr = 10 * w + 6.25 * h - 5 * a + gender_offset

    # 3. Dynamic Activity Multiplier
    act_clean = str(activity_level).strip().lower() if activity_level else "moderate"
    act_multiplier = ACTIVITY_MULTIPLIERS.get(act_clean, DEFAULT_ACTIVITY_MULTIPLIER)
    tdee = bmr * act_multiplier

    # 4. Dynamic Goal Profile Lookup
    goal_clean = str(goal_type).strip().lower() if goal_type else "fat_loss"
    profile = GOAL_PROFILES.get(goal_clean, DEFAULT_GOAL_PROFILE)

    # 5. Caloric Target with Safe Floors
    raw_target_calories = int(tdee * profile["calorie_multiplier"])
    target_calories = max(1200, min(raw_target_calories, 5500))

    # 6. Protein Target (Capped to prevent inverted ratios in high BMI)
    raw_protein = w * profile["protein_g_per_kg"]
    max_protein_from_calories = int((target_calories * 0.40) / 4)
    protein_g = max(45, min(int(raw_protein), 240, max_protein_from_calories))
    protein_cals = protein_g * 4

    # 7. Fat Target
    fat_g = max(30, int((target_calories * profile["fat_pct_calories"]) / 9))
    fat_cals = fat_g * 9

    # 8. Carbohydrates & Macro Balance
    remaining_cals = target_calories - (protein_cals + fat_cals)
    carbs_g = max(30, int(remaining_cals / 4))

    # 9. Energy Congruency Synchronization
    final_calories = protein_g * 4 + fat_g * 9 + carbs_g * 4

    return (final_calories, protein_g, carbs_g, fat_g)


async def update_user_goals(
    db: AsyncSession,
    user_id: int,
    goal_data: dict
) -> UserSettings:
    """Update goal settings and auto-compute macro targets unless overridden."""
    settings = await get_or_create_settings(db, user_id)

    # Update basic fields if provided
    for field in ["goal_type", "diet_type", "budget_tier", "age", "gender", "height_cm", "weight_kg", "activity_level", "workout_time"]:
        if field in goal_data and goal_data[field] is not None:
            setattr(settings, field, goal_data[field])

    # Morning Briefing Preferences
    if "morning_briefing_enabled" in goal_data and goal_data["morning_briefing_enabled"] is not None:
        settings.morning_briefing_enabled = 1 if goal_data["morning_briefing_enabled"] else 0
    if "morning_briefing_start_hour" in goal_data and goal_data["morning_briefing_start_hour"] is not None:
        settings.morning_briefing_start_hour = int(goal_data["morning_briefing_start_hour"])
    if "morning_briefing_end_hour" in goal_data and goal_data["morning_briefing_end_hour"] is not None:
        settings.morning_briefing_end_hour = int(goal_data["morning_briefing_end_hour"])
    if "morning_briefing_frequency" in goal_data and goal_data["morning_briefing_frequency"] is not None:
        settings.morning_briefing_frequency = str(goal_data["morning_briefing_frequency"])

    # Preserve initial starting weight benchmark
    if "weight_kg" in goal_data and goal_data["weight_kg"] is not None:
        if settings.start_weight_kg is None:
            settings.start_weight_kg = goal_data["weight_kg"]

    # Compute default targets
    c_goal, p_goal, carbs_g, f_goal = calculate_user_goals(
        goal_type=settings.goal_type,
        weight_kg=settings.weight_kg,
        height_cm=settings.height_cm,
        age=settings.age,
        gender=settings.gender,
        activity_level=settings.activity_level
    )

    # Apply overrides if explicitly given
    settings.calorie_goal = goal_data.get("calorie_goal") or c_goal
    settings.protein_goal = goal_data.get("protein_goal") or p_goal
    settings.carbs_goal = goal_data.get("carbs_goal") or carbs_g
    settings.fat_goal = goal_data.get("fat_goal") or f_goal

    await db.commit()
    await db.refresh(settings)
    logger.info(f"Updated user #{user_id} goals -> Cal:{settings.calorie_goal}, P:{settings.protein_goal}g, C:{settings.carbs_goal}g, F:{settings.fat_goal}g")
    return settings


async def update_calorie_goal(db: AsyncSession, user_id: int, calorie_goal: int) -> UserSettings:
    """Update the daily calorie goal for a user."""
    settings = await get_or_create_settings(db, user_id)
    settings.calorie_goal = calorie_goal
    await db.commit()
    await db.refresh(settings)
    return settings


async def save_selected_meal_plan(db: AsyncSession, user_id: int, meal_plan: dict) -> UserSettings:
    """Save the user's selected meal plan and update target macros if available."""
    settings = await get_or_create_settings(db, user_id)
    settings.selected_meal_plan = json.dumps(meal_plan)
    settings.last_plan_change_at = datetime.now(timezone.utc)

    if "daily_calories" in meal_plan and meal_plan["daily_calories"]:
        settings.calorie_goal = int(meal_plan["daily_calories"])
    if "protein_g" in meal_plan and meal_plan["protein_g"]:
        settings.protein_goal = int(meal_plan["protein_g"])
    if "carbs_g" in meal_plan and meal_plan["carbs_g"]:
        settings.carbs_goal = int(meal_plan["carbs_g"])
    if "fat_g" in meal_plan and meal_plan["fat_g"]:
        settings.fat_goal = int(meal_plan["fat_g"])

    await db.commit()
    await db.refresh(settings)
    logger.info(f"Saved selected meal plan for user #{user_id}: {meal_plan.get('title')}")
    return settings


async def swap_meal_plan_slots(
    db: AsyncSession,
    user_id: int,
    source_meal_type: str,
    target_meal_type: str,
) -> UserSettings:
    """
    Swap two meal slots in the user's active meal plan.
    Exchanges items between slots and updates their meal_type keys.
    CRITICAL: Does NOT touch `settings.last_plan_change_at`, preserving the 24h AI cooldown.
    """
    settings = await get_or_create_settings(db, user_id)
    if not settings.selected_meal_plan:
        raise HTTPException(
            status_code=400,
            detail="No active meal plan selected. Please generate and select a meal plan first."
        )

    try:
        plan_data = (
            json.loads(settings.selected_meal_plan)
            if isinstance(settings.selected_meal_plan, str)
            else settings.selected_meal_plan
        )
    except Exception as exc:
        logger.error(f"Failed to parse selected_meal_plan for user #{user_id}: {exc}")
        raise HTTPException(status_code=500, detail="Corrupted meal plan data. Please re-select a plan.")

    meals = plan_data.get("meals", [])
    if not isinstance(meals, list) or len(meals) < 2:
        raise HTTPException(
            status_code=400,
            detail="Active meal plan does not contain sufficient meal slots to swap."
        )

    src_lower = source_meal_type.strip().lower()
    tgt_lower = target_meal_type.strip().lower()

    src_idx = None
    tgt_idx = None
    for idx, meal in enumerate(meals):
        m_type = str(meal.get("meal_type", "")).strip().lower()
        if m_type == src_lower:
            src_idx = idx
        elif m_type == tgt_lower:
            tgt_idx = idx

    if src_idx is None:
        raise HTTPException(
            status_code=404,
            detail=f"Source meal type '{source_meal_type}' was not found in active meal plan."
        )
    if tgt_idx is None:
        raise HTTPException(
            status_code=404,
            detail=f"Target meal type '{target_meal_type}' was not found in active meal plan."
        )

    # Capture original slot display labels (e.g. "Breakfast", "Lunch")
    src_label = meals[src_idx].get("meal_type", source_meal_type)
    tgt_label = meals[tgt_idx].get("meal_type", target_meal_type)

    # Swap meal contents
    meals[src_idx], meals[tgt_idx] = meals[tgt_idx], meals[src_idx]

    # Update meal_type attributes so each item reflects its new slot
    meals[src_idx]["meal_type"] = src_label
    meals[tgt_idx]["meal_type"] = tgt_label

    # Save without modifying last_plan_change_at
    settings.selected_meal_plan = json.dumps(plan_data)
    await db.commit()
    await db.refresh(settings)

    logger.info(f"User #{user_id} swapped meal slots '{source_meal_type}' <-> '{target_meal_type}' without cooldown penalty")
    return settings


async def save_meal_plan_reorder(
    db: AsyncSession,
    user_id: int,
    meal_plan: dict,
) -> UserSettings:
    """
    Save client-synchronized reordered meal plan without touching last_plan_change_at.
    """
    settings = await get_or_create_settings(db, user_id)
    settings.selected_meal_plan = json.dumps(meal_plan)
    await db.commit()
    await db.refresh(settings)
    return settings

