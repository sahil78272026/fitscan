import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.settings import UserSettings
from app.services.auth_service import decode_jwt_token
from app.services.subscription_service import get_subscription_status
from app.services.meal_service import get_or_create_settings

logger = logging.getLogger("corecontrol.auth_middleware")

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that extracts and validates the JWT, returns the User."""
    token = credentials.credentials
    payload = decode_jwt_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def require_active_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency ensuring user has an active 7-day free trial or active paid/coupon subscription.

    If trial has expired and user has no active subscription, raises HTTP 402 Payment Required.
    """
    settings = None
    user_id = getattr(current_user, "id", None)
    if user_id is not None:
        try:
            res = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
            settings = res.scalar_one_or_none()
            if not settings:
                try:
                    settings = await get_or_create_settings(db, user_id)
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"Could not load settings for subscription check: {e}")

    sub = get_subscription_status(current_user, settings)
    if not sub["can_access_premium"]:
        trial_ended_at_str = (
            sub["trial_ends_at"].isoformat()
            if hasattr(sub["trial_ends_at"], "isoformat")
            else str(sub["trial_ends_at"])
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "TRIAL_EXPIRED",
                "message": "Your 7-day free trial has expired. Please subscribe or redeem a coupon to continue using meal scanning, logging, and AI meal plans.",
                "trial_ended_at": trial_ended_at_str,
                "trial_days_remaining": 0,
                "subscription_status": "trial_expired",
            },
        )
    return current_user

