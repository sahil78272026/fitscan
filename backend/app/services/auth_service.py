import logging
import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.settings import UserSettings

logger = logging.getLogger("fitscan.auth_service")
settings = get_settings()


# In-memory OTP store for dev mode: {phone: {"otp": str, "expires_at": datetime}}
_otp_store: dict = {}


def generate_otp(phone: str) -> str:
    """Generate a 6-digit OTP for dev mode fallback. Real SMS OTP is handled by Firebase Auth."""
    import secrets
    otp = str(secrets.randbelow(900000) + 100000)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)
    _otp_store[phone] = {"otp": otp, "expires_at": expires_at}
    logger.info(f"Dev OTP generated for {phone}: {otp}")
    return otp


def verify_otp(phone: str, otp: str) -> bool:
    """Verify OTP for a phone number."""
    # Dev OTP override — only in development mode
    if settings.APP_ENV == "development" and settings.DEV_OTP and otp == settings.DEV_OTP:
        logger.warning(f"Dev OTP bypass used for {phone} (APP_ENV=development)")
        if phone in _otp_store:
            del _otp_store[phone]
        return True

    stored = _otp_store.get(phone)
    if not stored:
        return False

    if datetime.now(timezone.utc) > stored["expires_at"]:
        del _otp_store[phone]
        return False

    if stored["otp"] != otp:
        return False

    # OTP is valid — remove it (one-time use)
    del _otp_store[phone]
    return True


def create_jwt_token(user_id: int, phone: str) -> str:
    """Create a JWT token for the authenticated user."""
    payload = {
        "sub": str(user_id),
        "phone": phone,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict | None:
    """Decode and validate a JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None


async def get_or_create_user(db: AsyncSession, phone: str, name: str | None = None) -> User:
    """Find existing user by phone or create a new one."""
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if user:
        # Update last login
        user.last_login = datetime.now(timezone.utc)
        if name and not user.name:
            user.name = name
        await db.commit()
        await db.refresh(user)
        logger.info(f"Existing user logged in: {phone} (id={user.id})")
    else:
        # Create new user
        user = User(phone=phone, name=name)
        db.add(user)
        await db.flush()

        user_settings = UserSettings(
            user_id=user.id,
            calorie_goal=2000,
            protein_goal=150,
            carbs_goal=200,
            fat_goal=65,
            goal_type="fat_loss",
            diet_type="veg",
            budget_tier="moderate",
            activity_level="moderate",
        )
        db.add(user_settings)
        await db.commit()
        await db.refresh(user)
        logger.info(f"New user created: {phone} (id={user.id}) with default settings")

    return user


async def verify_firebase_id_token(firebase_token: str) -> dict:
    """Decode and extract user information from Firebase Auth ID token."""
    try:
        decoded = jwt.decode(firebase_token, options={"verify_signature": False})
        phone_number = decoded.get("phone_number")
        uid = decoded.get("sub")
        if not phone_number and not uid:
            raise ValueError("Firebase token missing phone_number claim")
        return {"phone_number": phone_number, "uid": uid, "claims": decoded}
    except Exception as e:
        logger.error(f"Failed to decode Firebase token: {e}")
        raise ValueError(f"Invalid Firebase token: {e}")
