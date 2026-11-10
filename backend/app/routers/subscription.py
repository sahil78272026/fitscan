from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.middleware.auth import get_current_user
from app.services.subscription_service import get_subscription_status
from app.services.meal_service import get_or_create_settings

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


class SubscriptionStatusResponse(BaseModel):
    is_trial_active: bool
    trial_ends_at: datetime
    trial_days_remaining: int
    trial_hours_remaining: int
    has_active_subscription: bool
    subscription_tier: str
    subscription_status: str
    subscription_expires_at: Optional[datetime] = None
    can_access_premium: bool


@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_my_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve 7-day trial countdown and subscription status for the current user."""
    settings = await get_or_create_settings(db, current_user.id)
    return get_subscription_status(current_user, settings)
