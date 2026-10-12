from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any
import json
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database import get_db
from app.models.user import User
from app.schemas.meal import DailySummaryResponse
from app.services.meal_service import (
    get_daily_summary,
    get_meals_by_date,
    get_or_create_settings
)
from app.services.gemini_service import generate_morning_briefing
from app.middleware.auth import get_current_user


logger = logging.getLogger("corecontrol.routers.daily_summary")

router = APIRouter(prefix="/api/daily-summary", tags=["Daily Summary"])


@router.get("", response_model=DailySummaryResponse)
async def daily_summary(
    target_date: Optional[date] = Query(None, alias="date", description="Date to get summary for (default: today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calorie summary for a specific date (default: today)."""
    summary = await get_daily_summary(db, current_user.id, target_date)
    return summary


@router.get("/morning-briefing")
async def get_morning_briefing_endpoint(
    client_hour: Optional[int] = Query(None, description="Current local hour of user (0-23) to respect local timezone"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get personalized AI morning welcome feedback & daily improvements based on yesterday's nutrition.
    Respects user configurable start hour, end hour, frequency, and caches response per day.
    """
    settings = await get_or_create_settings(db, current_user.id)

    # 1. Check if feature is enabled
    is_enabled = bool(getattr(settings, "morning_briefing_enabled", 1) != 0)
    if not is_enabled:
        return {"visible": False, "reason": "disabled_by_user"}

    # 2. Morning window check: automatically active every morning from 5:00 AM to 12:00 PM (noon)
    current_hour = client_hour if client_hour is not None else datetime.utcnow().hour
    # Standard morning window: 5 AM - 12 PM
    if not (5 <= current_hour <= 12):
        return {
            "visible": False,
            "reason": f"outside_morning_window (morning is 5:00 AM - 12:00 PM, current is {current_hour}:00)",
        }

    # 3. Frequency checking: daily | weekdays | weekly
    today = date.today()
    frequency = getattr(settings, "morning_briefing_frequency", "daily") or "daily"
    weekday = today.weekday()  # Monday = 0, Sunday = 6

    if frequency == "weekdays" and weekday >= 5:  # Saturday or Sunday
        return {"visible": False, "reason": "frequency_weekdays_only"}

    if frequency == "weekly" and weekday != 0:  # Monday only for weekly recap
        return {"visible": False, "reason": "frequency_weekly_monday_only"}

    # 4. Check cache stored in settings (only generate once per date to preserve API performance)
    today_str = today.isoformat()
    if settings.morning_briefing_cache:
        try:
            cached_data = json.loads(settings.morning_briefing_cache)
            if cached_data.get("date") == today_str and "briefing" in cached_data:
                return {
                    "visible": True,
                    "date": today_str,
                    "briefing": cached_data["briefing"],
                    "from_cache": True
                }
        except Exception:
            pass

    # 5. Fetch yesterday's data
    yesterday = today - timedelta(days=1)
    yesterday_summary = await get_daily_summary(db, current_user.id, yesterday)
    yesterday_meals = await get_meals_by_date(db, current_user.id, yesterday)

    formatted_meals = []
    for m in yesterday_meals:
        formatted_meals.append({
            "meal_type": m.meal_type,
            "total_calories": m.total_calories,
            "raw_input": m.raw_input,
            "food_items": [{"name": item.name, "calories": item.calories} for item in (m.food_items or [])]
        })

    # 6. Generate briefing via Gemini
    briefing = await generate_morning_briefing(
        user_name=current_user.name or (current_user.email or "").split("@")[0] or "Friend",
        goal_type=settings.goal_type or "fat_loss",
        diet_type=settings.diet_type or "veg",
        calorie_goal=settings.calorie_goal or 2000,
        protein_goal=settings.protein_goal or 150,
        carbs_goal=settings.carbs_goal or 200,
        fat_goal=settings.fat_goal or 65,
        yesterday_calories=yesterday_summary.get("total_calories", 0),
        yesterday_protein=yesterday_summary.get("total_protein", 0.0),
        yesterday_carbs=yesterday_summary.get("total_carbs", 0.0),
        yesterday_fat=yesterday_summary.get("total_fat", 0.0),
        yesterday_meal_count=yesterday_summary.get("meal_count", 0),
        yesterday_meals=formatted_meals
    )

    # 7. Cache in DB for today
    try:
        settings.morning_briefing_cache = json.dumps({
            "date": today_str,
            "briefing": briefing
        })
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to cache morning briefing for user #{current_user.id}: {e}")

    return {
        "visible": True,
        "date": today_str,
        "briefing": briefing,
        "from_cache": False
    }

