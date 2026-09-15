import logging
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.step import StepLog
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.steps")

router = APIRouter(prefix="/api/steps", tags=["Step Tracking"])


class StepLogPayload(BaseModel):
    step_count: int = Field(..., ge=0, description="Steps taken")
    logged_date: Optional[date] = Field(None, description="Date for step log (default: today)")


class StepLogResponse(BaseModel):
    id: int
    step_count: int
    calories_burned: float
    logged_date: date

    class Config:
        from_attributes = True


class StepHistoryResponse(BaseModel):
    logs: List[StepLogResponse]
    total_steps_7d: int
    average_steps_7d: int
    total_calories_7d: float


def calculate_step_calories(steps: int) -> float:
    """Calculate estimated calories burned based on step count (~0.04 kcal / step)."""
    return round(steps * 0.04, 1)


@router.post("", response_model=StepLogResponse)
async def log_steps(
    payload: StepLogPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log or update step count for a given date."""
    target_date = payload.logged_date or date.today()
    calories = calculate_step_calories(payload.step_count)

    result = await db.execute(
        select(StepLog).where(
            StepLog.user_id == current_user.id,
            StepLog.logged_date == target_date,
        )
    )
    step_entry = result.scalar_one_or_none()

    if step_entry:
        step_entry.step_count = payload.step_count
        step_entry.calories_burned = calories
    else:
        step_entry = StepLog(
            user_id=current_user.id,
            step_count=payload.step_count,
            calories_burned=calories,
            logged_date=target_date,
        )
        db.add(step_entry)

    await db.commit()
    await db.refresh(step_entry)
    logger.info(f"Logged {payload.step_count} steps ({calories} kcal) for user #{current_user.id} on {target_date}")
    return step_entry


@router.get("/daily", response_model=StepLogResponse)
async def get_daily_steps(
    logged_date: Optional[date] = Query(None, description="Target date (default: today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get step count for a specific date (defaults to today)."""
    target_date = logged_date or date.today()

    result = await db.execute(
        select(StepLog).where(
            StepLog.user_id == current_user.id,
            StepLog.logged_date == target_date,
        )
    )
    step_entry = result.scalar_one_or_none()

    if not step_entry:
        return StepLogResponse(
            id=0,
            step_count=0,
            calories_burned=0.0,
            logged_date=target_date,
        )

    return step_entry


@router.get("/history", response_model=StepHistoryResponse)
async def get_step_history(
    days: int = Query(7, ge=1, le=365, description="Days of history to fetch"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch step count history and 7-day average metrics."""
    start_date = date.today() - timedelta(days=days - 1)

    result = await db.execute(
        select(StepLog)
        .where(
            StepLog.user_id == current_user.id,
            StepLog.logged_date >= start_date,
        )
        .order_by(StepLog.logged_date.asc())
    )
    logs = list(result.scalars().all())

    # Compute 7-day metrics
    seven_days_ago = date.today() - timedelta(days=6)
    logs_7d = [l for l in logs if l.logged_date >= seven_days_ago]

    total_steps_7d = sum(l.step_count for l in logs_7d)
    average_steps_7d = int(total_steps_7d / max(len(logs_7d), 1))
    total_calories_7d = round(sum(l.calories_burned for l in logs_7d), 1)

    return StepHistoryResponse(
        logs=logs,
        total_steps_7d=total_steps_7d,
        average_steps_7d=average_steps_7d,
        total_calories_7d=total_calories_7d,
    )
