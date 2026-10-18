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

logger = logging.getLogger("corecontrol.routers.stats")

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

    # Query past 90 days of daily calorie totals for streak tracking
    query_start_date = today - timedelta(days=90)
    result = await db.execute(
        select(
            Meal.meal_date,
            func.sum(Meal.total_calories).label("total_calories"),
            func.count(Meal.id).label("meal_count"),
            func.count(Meal.image_url).label("image_count"),
        )
        .where(
            Meal.user_id == current_user.id,
            Meal.meal_date >= query_start_date,
        )
        .group_by(Meal.meal_date)
        .order_by(Meal.meal_date.desc())
    )

    def to_date(val):
        if isinstance(val, str):
            return date.fromisoformat(val)
        if hasattr(val, "date") and callable(val.date):
            return val.date()
        return val

    daily_map = {}
    for row in result.all():
        d = to_date(row.meal_date)
        daily_map[d] = {
            "calories": row.total_calories or 0,
            "meal_count": row.meal_count or 0,
            "image_count": row.image_count or 0,
        }

    # 1. Calculate Streak: consecutive days user logged at least one meal
    current_streak = 0
    if today in daily_map and daily_map[today]["meal_count"] > 0:
        check_date = today
    elif (today - timedelta(days=1)) in daily_map and daily_map[today - timedelta(days=1)]["meal_count"] > 0:
        # Not logged today yet, but logged yesterday -> streak active
        check_date = today - timedelta(days=1)
    else:
        check_date = None

    while check_date and check_date in daily_map and daily_map[check_date]["meal_count"] > 0:
        current_streak += 1
        check_date -= timedelta(days=1)

    # 2. 7-Day Adherence Score & Daily Status Grid
    # Definition: "Adherence %" = share of days in the window where the user met their goal
    days_met_goal = 0
    seven_day_grid = []

    for i in range(6, -1, -1):
        day_date = today - timedelta(days=i)
        day_data = daily_map.get(day_date)

        has_logged = bool(day_data and day_data["meal_count"] > 0)
        if not has_logged:
            status = "no_log"
            score = 0.0
            logged_cals = 0
            met_goal = False
        else:
            logged_cals = day_data["calories"]
            diff_pct = abs(logged_cals - calorie_goal) / calorie_goal
            met_goal = diff_pct <= 0.15

            if met_goal:
                status = "on_target"
                score = 100.0
                days_met_goal += 1
            elif diff_pct <= 0.30:
                status = "close"
                score = 50.0
            else:
                status = "off_target"
                score = 0.0

        seven_day_grid.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "day_name": day_date.strftime("%a"),
            "calories": logged_cals,
            "status": status,
            "score": round(score, 1),
            "met_goal": met_goal,
        })

    # Share of days in the 7-day window where the user met their goal
    weekly_adherence_score = round((days_met_goal / 7.0) * 100.0, 1)

    # 3. Badges System (Continuous app engagement ladder)
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
            "title": "15-Day Macro Master",
            "icon": "🎯",
            "description": "Log meals for 15 consecutive days",
            "unlocked": current_streak >= 15,
        },
        {
            "id": "streak_30",
            "title": "30-Day Legend",
            "icon": "🏆",
            "description": "Log meals for 30 consecutive days",
            "unlocked": current_streak >= 30,
        },
    ]

    return {
        "current_streak": current_streak,
        "weekly_adherence_score": weekly_adherence_score,
        "calorie_goal": calorie_goal,
        "seven_day_grid": seven_day_grid,
        "badges": badges,
    }
