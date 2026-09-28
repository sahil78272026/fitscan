from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class SendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, description="Phone number with country code, e.g. +919876543210")


class SendOtpResponse(BaseModel):
    message: str
    phone: str


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)
    name: Optional[str] = Field(None, max_length=100, description="User's name (for new registration)")


class FirebaseVerifyRequest(BaseModel):
    firebase_token: str = Field(..., description="Firebase Auth ID Token")
    email: Optional[str] = Field(None, description="User's email address")
    phone: Optional[str] = Field(None, description="Formatted phone number")
    name: Optional[str] = Field(None, max_length=100, description="User's name (for new registration)")
    avatar_url: Optional[str] = Field(None, description="Profile picture URL")


class EmailLoginRequest(BaseModel):
    email: str = Field(..., max_length=255, description="Email address")
    name: Optional[str] = Field(None, max_length=100, description="User name")
    avatar_url: Optional[str] = Field(None, description="Profile picture URL")


class UserResponse(BaseModel):
    id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    is_new_user: bool
