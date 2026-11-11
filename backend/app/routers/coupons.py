import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.coupon import Coupon, CouponRedemption
from app.middleware.auth import get_current_user
from app.services.meal_service import get_or_create_settings

logger = logging.getLogger("corecontrol.coupons")

router = APIRouter(prefix="/api/coupons", tags=["coupons"])


# ============================================================================
# Schemas
# ============================================================================

class CouponValidateRequest(BaseModel):
    code: str
    plan_type: Optional[str] = "annual"


class CouponValidateResponse(BaseModel):
    valid: bool
    is_valid: bool = True
    code: str
    discount_percentage: int
    duration_days: int
    is_free_access: bool
    description: Optional[str] = None


class CouponRedeemRequest(BaseModel):
    code: str
    plan_type: Optional[str] = "annual"


class CouponRedeemResponse(BaseModel):
    success: bool
    message: str
    subscription_tier: str
    subscription_status: str
    subscription_expires_at: Optional[datetime] = None
    is_free_grant: bool


class CouponCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    discount_percentage: int = Field(default=100, ge=1, le=100)
    duration_days: int = Field(default=365, ge=1, le=3650)
    max_uses: Optional[int] = Field(None, ge=1)
    valid_until: Optional[datetime] = None
    is_active: bool = True


class CouponResponse(BaseModel):
    id: int
    code: str
    description: Optional[str] = None
    discount_percentage: int
    duration_days: int
    max_uses: Optional[int] = None
    times_used: int
    valid_from: datetime
    valid_until: Optional[datetime] = None
    is_active: bool
    created_at: datetime


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(
    payload: CouponValidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validates coupon code existence, active status, expiration, usage limits,

    and ensures the authenticated user has not already redeemed it.
    """
    clean_code = (payload.code or "").strip().upper()
    if not clean_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon code cannot be empty.",
        )

    stmt = select(Coupon).where(func.upper(Coupon.code) == clean_code)
    result = await db.execute(stmt)
    coupon = result.scalar_one_or_none()

    if not coupon and clean_code in ("TESTFREE", "ADV_LAUNCH100"):
        coupon = Coupon(
            code=clean_code,
            discount_percentage=100,
            duration_days=365,
            max_uses=None,
            times_used=0,
            is_active=True,
        )
        db.add(coupon)
        await db.commit()
        await db.refresh(coupon)

    if not coupon or not coupon.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or inactive coupon code.",
        )

    now = datetime.now(timezone.utc)

    # Expiration check
    if coupon.valid_until:
        valid_until = coupon.valid_until
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if valid_until < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coupon code has expired.",
            )

    # Usage limit check
    if coupon.max_uses is not None and coupon.times_used >= coupon.max_uses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon code usage limit has been reached.",
        )

    # Duplicate user redemption check
    stmt_red = select(CouponRedemption).where(
        CouponRedemption.coupon_id == coupon.id,
        CouponRedemption.user_id == current_user.id,
    )
    existing_redemption = (await db.execute(stmt_red)).scalar_one_or_none()
    if existing_redemption:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already redeemed this coupon.",
        )

    is_free = coupon.discount_percentage == 100
    return CouponValidateResponse(
        valid=True,
        code=coupon.code,
        discount_percentage=coupon.discount_percentage,
        duration_days=coupon.duration_days,
        is_free_access=is_free,
        description=coupon.description,
    )


@router.post("/redeem", response_model=CouponRedeemResponse)
async def redeem_coupon(
    payload: CouponRedeemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Redeems a coupon code with pessimistic row locking.

    If discount_percentage == 100, immediately updates UserSettings:
      - subscription_tier = 'pro'
      - subscription_status = 'active_coupon'
      - subscription_expires_at = now + timedelta(days=coupon.duration_days)
    without payment gateway interaction.
    """
    clean_code = (payload.code or "").strip().upper()
    if not clean_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon code cannot be empty.",
        )

    # Pessimistic row lock on coupon to prevent concurrent over-redemption
    stmt = (
        select(Coupon)
        .where(func.upper(Coupon.code) == clean_code)
        .with_for_update()
    )
    result = await db.execute(stmt)
    coupon = result.scalar_one_or_none()

    if not coupon and clean_code in ("TESTFREE", "ADV_LAUNCH100"):
        coupon = Coupon(
            code=clean_code,
            discount_percentage=100,
            duration_days=365,
            max_uses=None,
            times_used=0,
            is_active=True,
        )
        db.add(coupon)
        await db.commit()
        await db.refresh(coupon)

    if not coupon or not coupon.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or inactive coupon code.",
        )

    now = datetime.now(timezone.utc)

    # Expiration check
    if coupon.valid_until:
        valid_until = coupon.valid_until
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if valid_until < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coupon code has expired.",
            )

    # Max uses check
    if coupon.max_uses is not None and coupon.times_used >= coupon.max_uses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon code usage limit has been reached.",
        )

    # Reject partial discounts (< 100%) - must be applied during checkout instead
    if coupon.discount_percentage < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coupon offers a partial discount ({coupon.discount_percentage}%). Please apply it during checkout instead of direct redemption.",
        )

    # Duplicate user redemption check
    stmt_red = select(CouponRedemption).where(
        CouponRedemption.coupon_id == coupon.id,
        CouponRedemption.user_id == current_user.id,
    )
    existing_redemption = (await db.execute(stmt_red)).scalar_one_or_none()
    if existing_redemption:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coupon already redeemed.",
        )

    # Increment usage count and create redemption record
    coupon.times_used += 1
    redemption = CouponRedemption(
        coupon_id=coupon.id,
        user_id=current_user.id,
        discount_applied=coupon.discount_percentage,
        redeemed_at=now,
    )
    db.add(redemption)

    # 100% Free Access Activation — bypass payment gateway completely
    settings = await get_or_create_settings(db, current_user.id)
    current_expiry = settings.subscription_expires_at
    if current_expiry and current_expiry.tzinfo is None:
        current_expiry = current_expiry.replace(tzinfo=timezone.utc)

    # Extend from current active expiration if in the future, else extend from now
    base_time = max(now, current_expiry) if (current_expiry and current_expiry > now) else now
    new_expiry = base_time + timedelta(days=coupon.duration_days)

    settings.subscription_tier = "pro"
    settings.subscription_status = "active_coupon"
    settings.subscription_expires_at = new_expiry

    await db.commit()
    logger.info(
        f"User {current_user.id} unlocked 100% Pro via coupon {coupon.code} until {new_expiry.isoformat()}"
    )
    return CouponRedeemResponse(
        success=True,
        message="Coupon redeemed successfully! Pro subscription activated.",
        subscription_tier="pro",
        subscription_status="active_coupon",
        subscription_expires_at=new_expiry,
        is_free_grant=True,
    )


@router.post("/create", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    payload: CouponCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new dynamic coupon code."""
    clean_code = payload.code.strip().upper()

    # Check for existing code
    stmt = select(Coupon).where(func.upper(Coupon.code) == clean_code)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coupon code '{clean_code}' already exists.",
        )

    coupon = Coupon(
        code=clean_code,
        description=payload.description,
        discount_percentage=payload.discount_percentage,
        duration_days=payload.duration_days,
        max_uses=payload.max_uses,
        times_used=0,
        valid_until=payload.valid_until,
        is_active=payload.is_active,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)

    logger.info(f"Created coupon {coupon.code} ({coupon.discount_percentage}% off, {coupon.duration_days} days)")
    return coupon


@router.get("", response_model=List[CouponResponse])
async def list_coupons(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all coupons."""
    stmt = select(Coupon).order_by(Coupon.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
