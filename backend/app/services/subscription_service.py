from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from app.models.user import User
from app.models.settings import UserSettings

TRIAL_PERIOD_DAYS = 7


def get_subscription_status(user: User, settings: Optional[UserSettings] = None) -> Dict[str, Any]:
    """Calculate subscription and 7-day trial status for a user.
    
    Handles naive vs aware datetimes safely, defaults missing created_at to now for test compatibility,
    and returns canonical status dictionary according to PROJECT.md interface contract.
    """
    now = datetime.now(timezone.utc)

    # 1. Registration timestamp normalization
    created_at = getattr(user, "created_at", None)
    if created_at is None:
        created_at = now
    elif created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    # 2. 7-Day Free Trial Calculation
    trial_ends_at = created_at + timedelta(days=TRIAL_PERIOD_DAYS)
    is_trial_active = now < trial_ends_at

    if is_trial_active:
        remaining_delta = trial_ends_at - now
        trial_days_remaining = max(0, remaining_delta.days)
        trial_hours_remaining = max(0, int(remaining_delta.total_seconds() // 3600))
    else:
        trial_days_remaining = 0
        trial_hours_remaining = 0

    # 3. Active Paid or Coupon Subscription check
    tier = (getattr(settings, "subscription_tier", "free") or "free").lower()
    expires_at = getattr(settings, "subscription_expires_at", None)
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    has_active_sub = tier in ("pro", "premium", "lifetime") and (
        expires_at is None or expires_at > now
    )

    can_access = is_trial_active or has_active_sub

    # 4. Status determination
    if has_active_sub:
        resolved_tier = tier
        resolved_status = getattr(settings, "subscription_status", "active_paid") or "active_paid"
    elif is_trial_active:
        resolved_tier = "trial"
        resolved_status = "trial_active"
    else:
        resolved_tier = "expired"
        resolved_status = "trial_expired"

    return {
        "is_trial_active": is_trial_active,
        "trial_ends_at": trial_ends_at,
        "trial_days_remaining": trial_days_remaining,
        "trial_hours_remaining": trial_hours_remaining,
        "has_active_subscription": has_active_sub,
        "subscription_tier": resolved_tier,
        "subscription_status": resolved_status,
        "subscription_expires_at": expires_at,
        "can_access_premium": can_access,
    }
