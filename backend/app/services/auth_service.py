import logging
import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User

logger = logging.getLogger("fitscan.auth_service")
settings = get_settings()

# In-memory OTP store for dev mode: {phone: {"otp": str, "expires_at": datetime}}
_otp_store: dict = {}


def generate_otp(phone: str) -> str:
    """Generate and store OTP. In dev mode, always returns DEV_OTP."""
    otp = settings.DEV_OTP
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)
    _otp_store[phone] = {"otp": otp, "expires_at": expires_at}
    logger.info(f"OTP generated for {phone}: {otp} (dev mode)")
    # TODO: In production, send OTP via Firebase/SMS provider here
    return otp


def verify_otp(phone: str, otp: str) -> bool:
    """Verify OTP for a phone number."""
    # Always accept dev OTP "123456" or configured DEV_OTP
    if otp == "123456" or (settings.DEV_OTP and otp == settings.DEV_OTP):
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
        await db.commit()
        await db.refresh(user)
        logger.info(f"New user created: {phone} (id={user.id})")

    return user
