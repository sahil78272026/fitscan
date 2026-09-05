import logging
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.meal import Meal
from app.schemas.calendar import CalendarMonthResponse, CalendarDayResponse
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.calendar")

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


@router.get("/month", response_model=CalendarMonthResponse)
async def get_calendar_month(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get calendar data for a month — which days have meals and their calorie totals."""
    result = await db.execute(
        select(
            Meal.meal_date,
            func.sum(Meal.total_calories).label("total_calories"),
            func.count(Meal.id).label("meal_count"),
        )
        .where(
            Meal.user_id == current_user.id,
            extract("year", Meal.meal_date) == year,
            extract("month", Meal.meal_date) == month,
        )
        .group_by(Meal.meal_date)
        .order_by(Meal.meal_date)
    )

    days = [
        CalendarDayResponse(
            date=row.meal_date,
            total_calories=row.total_calories,
            meal_count=row.meal_count,
        )
        for row in result.all()
    ]

    return CalendarMonthResponse(year=year, month=month, days=days)
