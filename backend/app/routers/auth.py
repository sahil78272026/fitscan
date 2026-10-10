import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import SendOtpRequest, SendOtpResponse, VerifyOtpRequest, FirebaseVerifyRequest, EmailLoginRequest, AuthResponse, UserResponse
from app.services.auth_service import generate_otp, verify_otp, create_jwt_token, get_or_create_user, verify_firebase_id_token
from app.middleware.auth import get_current_user

logger = logging.getLogger("corecontrol.routers.auth")

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
    """Verify Firebase ID Token (Google SSO or Email) and return CoreControl JWT token. Creates user if new."""
    try:
        token_info = await verify_firebase_id_token(payload.firebase_token)
        email = token_info.get("email") or payload.email
        phone = token_info.get("phone_number") or payload.phone
        name = payload.name or token_info.get("name")
        avatar_url = payload.avatar_url or token_info.get("picture")

        if not email and not phone:
            raise HTTPException(status_code=400, detail="Could not resolve email or phone from Firebase token")

        if phone and not phone.startswith("+"):
            phone = f"+91{phone}"

        is_new = False
        if email:
            result = await db.execute(select(User).where(User.email == email))
            is_new = result.scalar_one_or_none() is None
        elif phone:
            result = await db.execute(select(User).where(User.phone == phone))
            is_new = result.scalar_one_or_none() is None

        user = await get_or_create_user(
            db,
            email=email,
            phone=phone,
            name=name,
            avatar_url=avatar_url,
        )
        token = create_jwt_token(user.id, phone=user.phone, email=user.email)

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


@router.post("/email-login", response_model=AuthResponse)
async def email_login_endpoint(payload: EmailLoginRequest, db: AsyncSession = Depends(get_db)):
    """Direct email login / registration (used in development or direct client auth)."""
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email address is required")

    result = await db.execute(select(User).where(User.email == email))
    existing_user = result.scalar_one_or_none()
    is_new = existing_user is None

    user = await get_or_create_user(
        db,
        email=email,
        name=payload.name,
        avatar_url=payload.avatar_url,
    )
    token = create_jwt_token(user.id, email=user.email, phone=user.phone)

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


class DeletionRequestPayload(BaseModel):
    identifier: str  # email or phone
    reason: Optional[str] = None


@router.delete("/me")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete user account and all associated personal data (meals, settings, weights, steps)."""
    user_id = current_user.id
    user_email = current_user.email
    await db.delete(current_user)
    await db.commit()
    logger.info(f"User #{user_id} ({user_email}) and all associated personal records permanently deleted.")
    return {"message": "Account and all associated personal data permanently deleted."}


@router.post("/request-data-deletion")
async def request_data_deletion(
    payload: DeletionRequestPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Public web endpoint for Google Play & Apple App Store data deletion compliance.
    Allows users who cannot access the app to request account and personal data deletion.
    """
    target = payload.identifier.strip().lower()
    if not target:
        raise HTTPException(status_code=400, detail="Valid email or phone number is required")

    result = await db.execute(
        select(User).where((User.email == target) | (User.phone == target))
    )
    user = result.scalar_one_or_none()

    if user:
        user_id = user.id
        await db.delete(user)
        await db.commit()
        logger.info(f"Account for {target} (User #{user_id}) purged via public deletion request.")
        return {
            "success": True,
            "message": f"Account and all associated personal data for {target} have been permanently deleted.",
        }

    # Return standard success message even if not found to prevent user enumeration
    return {
        "success": True,
        "message": f"If an account is associated with {target}, all records have been scheduled and permanently removed.",
    }
