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


class UserResponse(BaseModel):
    id: int
    phone: str
    name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    is_new_user: bool
