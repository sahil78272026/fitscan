import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.settings import CalorieGoalUpdate, SettingsResponse
from app.services.meal_service import get_or_create_settings, update_calorie_goal
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.settings")

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user settings (calorie goal)."""
    settings = await get_or_create_settings(db, current_user.id)
    return settings


@router.put("/calorie-goal", response_model=SettingsResponse)
async def set_calorie_goal(
    payload: CalorieGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the daily calorie goal."""
    settings = await update_calorie_goal(db, current_user.id, payload.calorie_goal)
    return settings
