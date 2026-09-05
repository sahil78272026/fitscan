import logging
from datetime import date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.meal import Meal, FoodItem
from app.models.settings import UserSettings
from app.services.gemini_service import analyze_food

logger = logging.getLogger("fitscan.meal_service")


async def create_meal(db: AsyncSession, user_id: int, raw_input: str, meal_type: str) -> Meal:
    """Analyze food with Gemini and store the meal + food items."""

    # Get calorie breakdown from Gemini
    analysis = await analyze_food(raw_input)

    # Create meal
    meal = Meal(
        user_id=user_id,
        meal_type=meal_type,
        raw_input=raw_input,
        total_calories=analysis["total_calories"],
        meal_date=date.today(),
    )
    db.add(meal)
    await db.flush()  # get meal.id

    # Create food items
    for item_data in analysis["items"]:
        food_item = FoodItem(
            meal_id=meal.id,
            name=item_data["name"],
            quantity=item_data["quantity"],
            unit=item_data["unit"],
            calories=item_data["calories"],
        )
        db.add(food_item)

    await db.commit()
    await db.refresh(meal, attribute_names=["food_items"])

    logger.info(f"Created meal #{meal.id} for user #{user_id}: {meal_type} — {meal.total_calories} kcal")
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
    """Get summary for a specific date: total calories, goal, remaining, meals."""
    if target_date is None:
        target_date = date.today()

    # Get meals
    meals = await get_meals_by_date(db, user_id, target_date)

    # Calculate totals
    total_calories = sum(m.total_calories for m in meals)

    # Get calorie goal
    settings = await get_or_create_settings(db, user_id)
    calorie_goal = settings.calorie_goal

    return {
        "date": target_date,
        "total_calories": total_calories,
        "calorie_goal": calorie_goal,
        "remaining": max(0, calorie_goal - total_calories),
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
        settings = UserSettings(user_id=user_id, calorie_goal=2000)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


async def update_calorie_goal(db: AsyncSession, user_id: int, calorie_goal: int) -> UserSettings:
    """Update the daily calorie goal for a user."""
    settings = await get_or_create_settings(db, user_id)
    settings.calorie_goal = calorie_goal
    await db.commit()
    await db.refresh(settings)
    logger.info(f"Updated calorie goal to {calorie_goal} for user #{user_id}")
    return settings
