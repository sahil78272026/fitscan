import logging
from datetime import date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.meal import Meal, FoodItem
from app.models.settings import UserSettings
from app.services.gemini_service import analyze_food

logger = logging.getLogger("fitscan.meal_service")


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

    await db.delete(meal)
    await db.commit()
    logger.info(f"Deleted meal #{meal_id} for user #{user_id}")
    return True


async def get_daily_summary(db: AsyncSession, user_id: int, target_date: date | None = None) -> dict:
    """Get summary for a specific date: total calories & macros, goals, remaining values, meals."""
    if target_date is None:
        target_date = date.today()

    # Get meals
    meals = await get_meals_by_date(db, user_id, target_date)

    # Calculate totals
    total_calories = sum(m.total_calories for m in meals)
    total_protein = round(sum(m.total_protein for m in meals), 1)
    total_carbs = round(sum(m.total_carbs for m in meals), 1)
    total_fat = round(sum(m.total_fat for m in meals), 1)

    # Get settings
    settings = await get_or_create_settings(db, user_id)

    return {
        "date": target_date,
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
        "meals": meals,
    }


async def get_or_create_settings(db: AsyncSession, user_id: int) -> UserSettings:
    """Get current settings for user or create default."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
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

    return settings


def calculate_user_goals(
    goal_type: str = "fat_loss",
    weight_kg: float | None = 70.0,
    height_cm: float | None = 170.0,
    age: int | None = 25,
    gender: str | None = "male",
    activity_level: str | None = "moderate"
) -> tuple[int, int, int, int]:
    """
    Calculate daily calorie and macro goals (Protein, Carbs, Fat) based on BMR, TDEE, and Goal Type.
    Returns: (calorie_goal, protein_goal, carbs_goal, fat_goal)
    """
    w = weight_kg or 70.0
    h = height_cm or 170.0
    a = age or 25
    g = gender or "male"
    act = activity_level or "moderate"

    # Mifflin-St Jeor Equation for BMR
    if g == "male":
        bmr = 10 * w + 6.25 * h - 5 * a + 5
    else:
        bmr = 10 * w + 6.25 * h - 5 * a - 161

    # Activity multiplier
    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "very_active": 1.725
    }
    tdee = bmr * multipliers.get(act, 1.55)

    # Goal adjustment factor & protein target (g per kg bodyweight)
    if goal_type == "fat_loss":
        target_calories = int(tdee * 0.80)
        p_factor = 2.0
    elif goal_type == "weight_loss":
        target_calories = int(tdee * 0.85)
        p_factor = 1.8
    elif goal_type == "muscle_building":
        target_calories = int(tdee * 1.12)
        p_factor = 2.2
    else:  # muscle_maintain
        target_calories = int(tdee * 1.00)
        p_factor = 1.8

    protein_g = int(w * p_factor)
    # Fat target: 25% of calories (9 kcal/g)
    fat_g = int((target_calories * 0.25) / 9)
    # Carbs target: Remaining calories (4 kcal/g)
    remaining_cals = target_calories - (protein_g * 4 + fat_g * 9)
    carbs_g = max(50, int(remaining_cals / 4))

    return (target_calories, protein_g, carbs_g, fat_g)


async def update_user_goals(
    db: AsyncSession,
    user_id: int,
    goal_data: dict
) -> UserSettings:
    """Update goal settings and auto-compute macro targets unless overridden."""
    settings = await get_or_create_settings(db, user_id)

    # Update basic fields if provided
    for field in ["goal_type", "diet_type", "budget_tier", "age", "gender", "height_cm", "weight_kg", "activity_level"]:
        if field in goal_data and goal_data[field] is not None:
            setattr(settings, field, goal_data[field])

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
    logger.info(f"Updated calorie goal to {calorie_goal} for user #{user_id}")
    return settings

