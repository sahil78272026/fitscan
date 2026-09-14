import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import SendOtpRequest, SendOtpResponse, VerifyOtpRequest, FirebaseVerifyRequest, AuthResponse, UserResponse
from app.services.auth_service import generate_otp, verify_otp, create_jwt_token, get_or_create_user, verify_firebase_id_token
from app.middleware.auth import get_current_user

logger = logging.getLogger("fitscan.routers.auth")

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp(payload: SendOtpRequest):
    """Send OTP to the given phone number. In dev mode, OTP is always 123456."""
    generate_otp(payload.phone)
    return SendOtpResponse(
        message="OTP sent successfully",
        phone=payload.phone,
    )


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp_endpoint(payload: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return JWT token. Creates user if new."""
    if not verify_otp(payload.phone, payload.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Check if user exists before creating
    result = await db.execute(select(User).where(User.phone == payload.phone))
    existing_user = result.scalar_one_or_none()
    is_new = existing_user is None

    # Get or create user
    user = await get_or_create_user(db, payload.phone, payload.name)

    # Generate JWT
    token = create_jwt_token(user.id, user.phone)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
        is_new_user=is_new,
    )


@router.post("/firebase-verify", response_model=AuthResponse)
async def firebase_verify_endpoint(payload: FirebaseVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify Firebase ID Token and return FitScan JWT token. Creates user if new."""
    try:
        token_info = await verify_firebase_id_token(payload.firebase_token)
        phone = token_info.get("phone_number") or payload.phone
        if not phone:
            raise HTTPException(status_code=400, detail="Could not resolve phone number from Firebase token")

        if not phone.startswith("+"):
            phone = f"+91{phone}"

        result = await db.execute(select(User).where(User.phone == phone))
        existing_user = result.scalar_one_or_none()
        is_new = existing_user is None

        user = await get_or_create_user(db, phone, payload.name)
        token = create_jwt_token(user.id, user.phone)

        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user),
            is_new_user=is_new,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Firebase verification error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile (name)."""
    current_user.name = name
    await db.commit()
    await db.refresh(current_user)
    return current_user
