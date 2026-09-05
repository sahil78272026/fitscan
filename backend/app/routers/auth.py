import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import SendOtpRequest, SendOtpResponse, VerifyOtpRequest, AuthResponse, UserResponse
from app.services.auth_service import generate_otp, verify_otp, create_jwt_token, get_or_create_user
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
