import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.meal import DailySummaryResponse
from app.services.meal_service import get_daily_summary
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.daily_summary")

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
