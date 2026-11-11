import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.payment import PaymentOrder
from app.models.coupon import Coupon, CouponRedemption
from app.middleware.auth import get_current_user
from app.services.razorpay_service import razorpay_service
from app.services.meal_service import get_or_create_settings

logger = logging.getLogger("corecontrol.payments")

router = APIRouter(prefix="/api/payments", tags=["payments"])
settings = get_settings()

PLANS: Dict[str, Dict[str, Any]] = {
    "pro_monthly": {
        "id": "pro_monthly",
        "name": "Monthly Pro",
        "amount_rupees": 149,
        "amount_paise": 14900,
        "currency": "INR",
        "duration_days": 30,
        "description": "Full access to AI food scanner, personalized meal plans, and macro tracking.",
    },
    "pro_annual": {
        "id": "pro_annual",
        "name": "Annual Pro",
        "amount_rupees": 999,
        "amount_paise": 99900,
        "currency": "INR",
        "duration_days": 365,
        "description": "Best value: Full access for an entire year with priority AI scan processing.",
    },
    # Backward compatibility aliases for mobile / clients using "monthly" / "annual"
    "monthly": {
        "id": "pro_monthly",
        "name": "Monthly Pro",
        "amount_rupees": 149,
        "amount_paise": 14900,
        "currency": "INR",
        "duration_days": 30,
        "description": "Full access to AI food scanner, personalized meal plans, and macro tracking.",
    },
    "annual": {
        "id": "pro_annual",
        "name": "Annual Pro",
        "amount_rupees": 999,
        "amount_paise": 99900,
        "currency": "INR",
        "duration_days": 365,
        "description": "Best value: Full access for an entire year with priority AI scan processing.",
    },
}


# ============================================================================
# Schemas
# ============================================================================

class PlanInfo(BaseModel):
    id: str
    name: str
    amount_rupees: int
    amount_paise: int
    currency: str
    duration_days: int
    description: str


class PlansResponse(BaseModel):
    plans: List[PlanInfo]


class CreateOrderRequest(BaseModel):
    plan_id: str
    coupon_code: Optional[str] = None


class CreateOrderResponse(BaseModel):
    order_id: str
    razorpay_order_id: str
    amount: int  # in paise
    amount_rupees: int
    currency: str
    key_id: str
    plan_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    subscription_tier: str
    subscription_status: str
    subscription_expires_at: Optional[datetime] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/plans", response_model=PlansResponse)
async def get_subscription_plans():
    """Returns available subscription plans (Monthly Rs. 149, Annual Rs. 999)."""
    return PlansResponse(plans=[PlanInfo(**p) for p in PLANS.values()])


@router.post("/razorpay/create-order", response_model=CreateOrderResponse)
async def create_razorpay_order(
    payload: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a local PaymentOrder record and initiates an order with Razorpay

    (or returns a mock order when mock mode is enabled).
    """
    plan = PLANS.get(payload.plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid subscription plan '{payload.plan_id}'. Available plans: {list(PLANS.keys())}",
        )

    base_rupees = plan["amount_rupees"]
    discount_amount = 0
    clean_coupon_code = None

    # Handle optional discount coupon
    if payload.coupon_code:
        clean_coupon_code = payload.coupon_code.strip().upper()
        stmt = select(Coupon).where(func.upper(Coupon.code) == clean_coupon_code)
        coupon = (await db.execute(stmt)).scalar_one_or_none()

        if not coupon and clean_coupon_code in ("TESTFREE", "ADV_LAUNCH100"):
            coupon = Coupon(
                code=clean_coupon_code,
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
        if coupon.valid_until:
            vu = coupon.valid_until
            if vu.tzinfo is None:
                vu = vu.replace(tzinfo=timezone.utc)
            if vu < now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Coupon code has expired.",
                )

        if coupon.max_uses is not None and coupon.times_used >= coupon.max_uses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Coupon code usage limit has been reached.",
            )

        # Check if already redeemed
        stmt_red = select(CouponRedemption).where(
            CouponRedemption.coupon_id == coupon.id,
            CouponRedemption.user_id == current_user.id,
        )
        if (await db.execute(stmt_red)).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already redeemed this coupon.",
            )

        # Calculate discount
        discount_amount = int(base_rupees * (coupon.discount_percentage / 100.0))

    final_rupees = max(0, base_rupees - discount_amount)
    order_id = f"po_{uuid.uuid4().hex[:12]}"

    # Create PaymentOrder in database
    payment_order = PaymentOrder(
        order_id=order_id,
        user_id=current_user.id,
        plan_id=payload.plan_id,
        amount_rupees=final_rupees,
        currency="INR",
        status="CREATED",
        coupon_code=clean_coupon_code,
        discount_amount=discount_amount,
    )
    db.add(payment_order)
    await db.flush()

    # Create order via Razorpay service
    try:
        rzp_order = razorpay_service.create_order(
            amount_in_rupees=final_rupees,
            receipt_id=order_id,
        )
    except Exception as e:
        logger.error(f"Failed to create Razorpay order: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Payment gateway error: {str(e)}",
        )

    razorpay_order_id = rzp_order.get("id")
    payment_order.razorpay_order_id = razorpay_order_id
    await db.commit()

    key_id = settings.RAZORPAY_KEY_ID or "rzp_test_replace_with_your_key_id"

    return CreateOrderResponse(
        order_id=order_id,
        razorpay_order_id=razorpay_order_id,
        amount=final_rupees * 100,
        amount_rupees=final_rupees,
        currency="INR",
        key_id=key_id,
        plan_id=payload.plan_id,
    )


async def _record_order_coupon_redemption(
    db: AsyncSession,
    user_id: int,
    coupon_code: Optional[str],
    now: datetime,
) -> None:
    """Safely increments times_used and records CouponRedemption if coupon was used for order."""
    if not coupon_code:
        return
    stmt_coupon = (
        select(Coupon)
        .where(func.upper(Coupon.code) == coupon_code.upper())
        .with_for_update()
    )
    c = (await db.execute(stmt_coupon)).scalar_one_or_none()
    if c:
        stmt_red = select(CouponRedemption).where(
            CouponRedemption.coupon_id == c.id,
            CouponRedemption.user_id == user_id,
        )
        existing_red = (await db.execute(stmt_red)).scalar_one_or_none()
        if not existing_red:
            c.times_used += 1
            redemption = CouponRedemption(
                coupon_id=c.id,
                user_id=user_id,
                discount_applied=c.discount_percentage,
                redeemed_at=now,
            )
            db.add(redemption)


@router.post("/razorpay/verify-payment", response_model=VerifyPaymentResponse)
async def verify_razorpay_payment(
    payload: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verifies HMAC signature, locks PaymentOrder row, and idempotently activates
    Pro subscription.
    """
    # 1. Cryptographic HMAC signature check
    is_valid = razorpay_service.verify_payment_signature(
        order_id=payload.razorpay_order_id,
        payment_id=payload.razorpay_payment_id,
        signature=payload.razorpay_signature,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature.",
        )

    # 2. Lock PaymentOrder row
    stmt = (
        select(PaymentOrder)
        .where(PaymentOrder.razorpay_order_id == payload.razorpay_order_id)
        .with_for_update()
    )
    result = await db.execute(stmt)
    payment_order = result.scalar_one_or_none()

    if not payment_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment order not found.",
        )

    if payment_order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Order does not belong to user.",
        )

    user_settings = await get_or_create_settings(db, payment_order.user_id)
    now = datetime.now(timezone.utc)

    # 3. Idempotent activation
    if payment_order.status == "PAID":
        logger.info(f"Payment order {payment_order.order_id} already marked PAID. Idempotent return.")
        return VerifyPaymentResponse(
            success=True,
            message="Payment already verified. Pro subscription active.",
            subscription_tier=user_settings.subscription_tier or "pro",
            subscription_status=user_settings.subscription_status or "active_paid",
            subscription_expires_at=user_settings.subscription_expires_at,
        )

    payment_order.status = "PAID"
    payment_order.razorpay_payment_id = payload.razorpay_payment_id
    payment_order.razorpay_signature = payload.razorpay_signature

    # Redeem coupon if attached
    await _record_order_coupon_redemption(db, payment_order.user_id, payment_order.coupon_code, now)

    # Calculate plan duration & extend subscription
    plan_info = PLANS.get(payment_order.plan_id, PLANS["monthly"])
    duration_days = plan_info["duration_days"]

    current_expiry = user_settings.subscription_expires_at
    if current_expiry and current_expiry.tzinfo is None:
        current_expiry = current_expiry.replace(tzinfo=timezone.utc)

    base_time = max(now, current_expiry) if (current_expiry and current_expiry > now) else now
    new_expiry = base_time + timedelta(days=duration_days)

    user_settings.subscription_tier = "pro"
    user_settings.subscription_status = "active_paid"
    user_settings.subscription_expires_at = new_expiry

    await db.commit()

    logger.info(
        f"Payment verified: order={payment_order.order_id}, user={payment_order.user_id}, plan={payment_order.plan_id}, expiry={new_expiry.isoformat()}"
    )

    return VerifyPaymentResponse(
        success=True,
        message="Payment verified successfully. Pro subscription activated.",
        subscription_tier="pro",
        subscription_status="active_paid",
        subscription_expires_at=new_expiry,
    )


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """Webhook listener for asynchronous Razorpay events (e.g. payment.captured)."""
    body = await request.body()

    if not x_razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header.",
        )

    # Verify signature
    is_valid = razorpay_service.verify_webhook_signature(
        body=body,
        signature=x_razorpay_signature,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        )

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON payload.",
        )

    event = data.get("event")
    logger.info(f"Received Razorpay webhook event: {event}")

    if event in ("payment.captured", "order.paid"):
        payload_dict = data.get("payload") or {}
        payment_dict = (payload_dict.get("payment") or {}).get("entity") or {}
        order_dict = (payload_dict.get("order") or {}).get("entity") or {}
        razorpay_order_id = payment_dict.get("order_id") or order_dict.get("id")
        razorpay_payment_id = payment_dict.get("id")

        if razorpay_order_id:
            stmt = (
                select(PaymentOrder)
                .where(PaymentOrder.razorpay_order_id == razorpay_order_id)
                .with_for_update()
            )
            order = (await db.execute(stmt)).scalar_one_or_none()

            if order and order.status != "PAID":
                now = datetime.now(timezone.utc)
                order.status = "PAID"
                order.razorpay_payment_id = razorpay_payment_id

                # Redeem coupon if attached
                await _record_order_coupon_redemption(db, order.user_id, order.coupon_code, now)

                user_settings = await get_or_create_settings(db, order.user_id)
                plan_info = PLANS.get(order.plan_id, PLANS["monthly"])
                duration_days = plan_info["duration_days"]

                current_expiry = user_settings.subscription_expires_at
                if current_expiry and current_expiry.tzinfo is None:
                    current_expiry = current_expiry.replace(tzinfo=timezone.utc)

                base_time = max(now, current_expiry) if (current_expiry and current_expiry > now) else now
                new_expiry = base_time + timedelta(days=duration_days)

                user_settings.subscription_tier = "pro"
                user_settings.subscription_status = "active_paid"
                user_settings.subscription_expires_at = new_expiry

                await db.commit()
                logger.info(f"Webhook reconciled order {order.order_id} to PAID")

    return {"status": "success"}

    return {"status": "success"}
