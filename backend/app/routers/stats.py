import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.meal import Meal
from app.services.meal_service import get_or_create_settings
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.stats")

router = APIRouter(prefix="/api/stats", tags=["Stats & Gamification"])


@router.get("/adherence")
async def get_adherence_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get streak, 7-day adherence score, 7-day history status, and unlocked badges."""
    today = date.today()
    settings = await get_or_create_settings(db, current_user.id)
    calorie_goal = settings.calorie_goal or 2000

    # Query last 30 days of daily calorie totals
    thirty_days_ago = today - timedelta(days=30)
    result = await db.execute(
        select(
            Meal.meal_date,
            func.sum(Meal.total_calories).label("total_calories"),
            func.count(Meal.id).label("meal_count"),
            func.count(Meal.image_url).label("image_count"),
        )
        .where(
            Meal.user_id == current_user.id,
            Meal.meal_date >= thirty_days_ago,
        )
        .group_by(Meal.meal_date)
        .order_by(Meal.meal_date.desc())
    )

    daily_map = {
        row.meal_date: {
            "calories": row.total_calories or 0,
            "meal_count": row.meal_count or 0,
            "image_count": row.image_count or 0,
        }
        for row in result.all()
    }

    # 1. Calculate Streak (consecutive days with at least 1 meal logged)
    current_streak = 0
    check_date = today

    # If nothing logged today yet, check starting yesterday so streak doesn't reset early in the day
    if today not in daily_map:
        check_date = today - timedelta(days=1)

    while check_date in daily_map:
        current_streak += 1
        check_date -= timedelta(days=1)

    # 2. 7-Day Adherence Score & Daily Status Grid
    weekly_scores = []
    seven_day_grid = []

    for i in range(6, -1, -1):
        day_date = today - timedelta(days=i)
        day_data = daily_map.get(day_date)

        if not day_data:
            status = "no_log"
            score = 0.0
            logged_cals = 0
        else:
            logged_cals = day_data["calories"]
            diff_pct = abs(logged_cals - calorie_goal) / calorie_goal
            score = max(0.0, (1.0 - diff_pct) * 100.0)

            if diff_pct <= 0.15:
                status = "on_target"
            elif diff_pct <= 0.30:
                status = "close"
            else:
                status = "off_target"

        weekly_scores.append(score)
        seven_day_grid.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "day_name": day_date.strftime("%a"),
            "calories": logged_cals,
            "status": status,
            "score": round(score, 1),
        })

    weekly_adherence_score = round(sum(weekly_scores) / 7.0, 1)

    # 3. Badges System
    total_images_logged = sum(d["image_count"] for d in daily_map.values())

    badges = [
        {
            "id": "streak_3",
            "title": "3-Day Warmup",
            "icon": "🔥",
            "description": "Log meals for 3 consecutive days",
            "unlocked": current_streak >= 3,
        },
        {
            "id": "streak_7",
            "title": "7-Day Warrior",
            "icon": "⚡",
            "description": "Log meals for 7 consecutive days",
            "unlocked": current_streak >= 7,
        },
        {
            "id": "macro_master",
            "title": "Macro Master",
            "icon": "🎯",
            "description": "Achieve an 80%+ weekly adherence score",
            "unlocked": weekly_adherence_score >= 80.0,
        },
        {
            "id": "ai_visionary",
            "title": "AI Visionary",
            "icon": "📷",
            "description": "Log 3+ meals using AI Photo Scan",
            "unlocked": total_images_logged >= 3,
        },
    ]

    return {
        "current_streak": current_streak,
        "weekly_adherence_score": weekly_adherence_score,
        "calorie_goal": calorie_goal,
        "seven_day_grid": seven_day_grid,
        "badges": badges,
    }
