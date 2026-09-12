import logging
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.weight import WeightLog
from app.services.meal_service import get_or_create_settings
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.weight")

router = APIRouter(prefix="/api/weight", tags=["Weight Tracking"])


class WeightLogPayload(BaseModel):
    weight_kg: float = Field(..., gt=20.0, lt=300.0, description="Weight in kilograms")
    logged_date: Optional[date] = Field(None, description="Date for weight entry (default: today)")


class WeightLogResponse(BaseModel):
    id: int
    weight_kg: float
    logged_date: date

    class Config:
        from_attributes = True


class WeightHistoryResponse(BaseModel):
    logs: list[WeightLogResponse]
    start_weight: Optional[float] = None
    current_weight: Optional[float] = None
    net_change_kg: Optional[float] = None


@router.post("", response_model=WeightLogResponse)
async def log_weight(
    payload: WeightLogPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log or update body weight for a given date."""
    target_date = payload.logged_date or date.today()

    # Check if entry already exists for this date
    result = await db.execute(
        select(WeightLog).where(
            WeightLog.user_id == current_user.id,
            WeightLog.logged_date == target_date,
        )
    )
    weight_entry = result.scalar_one_or_none()

    if weight_entry:
        weight_entry.weight_kg = round(payload.weight_kg, 2)
    else:
        weight_entry = WeightLog(
            user_id=current_user.id,
            weight_kg=round(payload.weight_kg, 2),
            logged_date=target_date,
        )
        db.add(weight_entry)

    # Sync latest weight with user_settings
    settings = await get_or_create_settings(db, current_user.id)
    if settings.start_weight_kg is None and settings.weight_kg is not None:
        settings.start_weight_kg = settings.weight_kg
    settings.weight_kg = round(payload.weight_kg, 2)

    await db.commit()
    await db.refresh(weight_entry)
    logger.info(f"Logged weight {weight_entry.weight_kg}kg for user #{current_user.id} on {target_date}")
    return weight_entry


@router.get("/history", response_model=WeightHistoryResponse)
async def get_weight_history(
    days: int = Query(30, ge=7, le=365, description="Days of history to fetch"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get weight history for chart rendering with preserved baseline start_weight statistics."""
    settings = await get_or_create_settings(db, current_user.id)

    # 1. Fetch earliest weight log ever recorded for this user
    earliest_res = await db.execute(
        select(WeightLog)
        .where(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_date.asc(), WeightLog.id.asc())
        .limit(1)
    )
    first_log = earliest_res.scalar_one_or_none()

    # 2. Fetch latest weight log recorded for this user (current_weight)
    latest_res = await db.execute(
        select(WeightLog)
        .where(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_date.desc(), WeightLog.id.desc())
        .limit(1)
    )
    latest_log = latest_res.scalar_one_or_none()

    # Prioritize onboarding starting weight baseline, falling back to earliest log or current settings
    start_weight = settings.start_weight_kg
    if start_weight is None:
        start_weight = first_log.weight_kg if first_log else settings.weight_kg

    current_weight = latest_log.weight_kg if latest_log else settings.weight_kg

    net_change_kg = None
    if start_weight is not None and current_weight is not None:
        net_change_kg = round(current_weight - start_weight, 2)

    # 3. Fetch timeframe logs for line chart
    start_date = date.today() - timedelta(days=days)
    result = await db.execute(
        select(WeightLog)
        .where(
            WeightLog.user_id == current_user.id,
            WeightLog.logged_date >= start_date,
        )
        .order_by(WeightLog.logged_date.asc())
    )
    logs = list(result.scalars().all())

    return WeightHistoryResponse(
        logs=logs,
        start_weight=start_weight,
        current_weight=current_weight,
        net_change_kg=net_change_kg,
    )


@router.delete("/{log_id}")
async def delete_weight_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific weight entry."""
    result = await db.execute(
        select(WeightLog).where(
            WeightLog.id == log_id,
            WeightLog.user_id == current_user.id,
        )
    )
    log_entry = result.scalar_one_or_none()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Weight log entry not found")

    await db.delete(log_entry)
    await db.commit()
    return {"message": "Weight log deleted"}
