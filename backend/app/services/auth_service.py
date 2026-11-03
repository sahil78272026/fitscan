import os
import logging
import jwt
from jwt import PyJWKClient
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import firebase_admin
from firebase_admin import credentials as fb_credentials, auth as fb_admin_auth

from app.config import get_settings
from app.models.user import User
from app.models.settings import UserSettings

logger = logging.getLogger("corecontrol.auth_service")
settings = get_settings()

# Google Public JWKS Client for signature verification
_GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
_jwks_client = PyJWKClient(_GOOGLE_JWKS_URL, cache_keys=True)


def _init_firebase_admin_if_possible() -> bool:
    """Initialize firebase-admin SDK if service account file is present."""
    if firebase_admin._apps:
        return True
    sa_path = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
    if os.path.exists(sa_path):
        try:
            cred = fb_credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred, options={"projectId": settings.FIREBASE_PROJECT_ID})
            logger.info(f"Firebase Admin initialized with service account from {sa_path}")
            return True
        except Exception as e:
            logger.warning(f"Could not initialize Firebase Admin with service account: {e}")
    return False


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
    current_settings = get_settings()
    is_dev_otp = (current_settings.DEV_OTP and otp == current_settings.DEV_OTP) or otp == "123456"

    # In production or any non-development environment, DEV_OTP is strictly rejected
    if current_settings.APP_ENV != "development":
        if is_dev_otp:
            logger.warning(f"Dev OTP attempted in non-development environment ({current_settings.APP_ENV}) for {phone}")
            return False
    else:
        # Dev OTP override — only in development mode
        if is_dev_otp:
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


def create_jwt_token(user_id: int, phone: str | None = None, email: str | None = None) -> str:
    """Create a JWT token for the authenticated user."""
    payload = {
        "sub": str(user_id),
        "phone": phone,
        "email": email,
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


async def get_or_create_user(
    db: AsyncSession,
    email: str | None = None,
    phone: str | None = None,
    name: str | None = None,
    avatar_url: str | None = None,
) -> User:
    """Find existing user by email or phone or create a new one."""
    user = None
    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
    if not user and phone:
        result = await db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

    if user:
        # Update last login and missing details
        user.last_login = datetime.now(timezone.utc)
        if name and not user.name:
            user.name = name
        if email and not user.email:
            user.email = email
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(user)
        logger.info(f"Existing user logged in: {user.email or user.phone} (id={user.id})")
    else:
        # Create new user
        user = User(email=email, phone=phone, name=name, avatar_url=avatar_url)
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
        logger.info(f"New user created: {user.email or user.phone} (id={user.id}) with default settings")

    return user


async def verify_firebase_id_token(firebase_token: str) -> dict:
    """
    Cryptographically verify Firebase ID token (Google SSO, Email/Pass, or Phone).
    Uses firebase-admin SDK if service account is available, or Google's official public
    JWKS keys with PyJWT to verify RS256 signature, expiry, audience, and issuer.
    """
    project_id = settings.FIREBASE_PROJECT_ID
    if not project_id:
        raise ValueError("FIREBASE_PROJECT_ID is not configured in backend settings")

    # 1. If Firebase Admin SDK is configured with service account, use it
    if _init_firebase_admin_if_possible():
        try:
            decoded = fb_admin_auth.verify_id_token(firebase_token)
            return {
                "email": decoded.get("email"),
                "phone_number": decoded.get("phone_number"),
                "name": decoded.get("name"),
                "picture": decoded.get("picture"),
                "uid": decoded.get("uid") or decoded.get("sub"),
                "claims": decoded,
            }
        except Exception as e:
            logger.error(f"Firebase Admin token verification failed: {e}")
            raise ValueError(f"Invalid or expired Firebase ID token: {e}")

    # 2. Standard verification using Google's public JWKS endpoint (Zero service account JSON needed)
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(firebase_token)
        expected_issuer = f"https://securetoken.google.com/{project_id}"

        decoded = jwt.decode(
            firebase_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=expected_issuer,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )

        email = decoded.get("email")
        phone_number = decoded.get("phone_number")
        name = decoded.get("name")
        picture = decoded.get("picture")
        uid = decoded.get("user_id") or decoded.get("sub")

        if not email and not phone_number and not uid:
            raise ValueError("Firebase token missing user identity claims")

        return {
            "email": email,
            "phone_number": phone_number,
            "name": name,
            "picture": picture,
            "uid": uid,
            "claims": decoded,
        }
    except jwt.ExpiredSignatureError:
        logger.warning("Firebase ID token has expired")
        raise ValueError("Firebase token has expired. Please sign in again.")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid Firebase token cryptographic signature or claims: {e}")
        raise ValueError(f"Invalid Firebase ID token: {e}")
    except Exception as e:
        logger.error(f"Unexpected error verifying Firebase token: {e}")
        raise ValueError(f"Failed to verify Firebase token: {e}")
