from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List


class DeviceTokenRegister(BaseModel):
    push_token: str = Field(..., min_length=5, max_length=255, description="Expo push token (e.g. ExponentPushToken[...])")
    platform: Optional[str] = Field("android", max_length=50, description="Client platform: android, ios, or web")
    device_name: Optional[str] = Field(None, max_length=100, description="Optional friendly name of the device")


class DeviceTokenResponse(BaseModel):
    success: bool = True
    device_id: int
    push_token: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferencesUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    meal_reminders_enabled: Optional[bool] = None
    breakfast_reminder_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    lunch_reminder_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    dinner_reminder_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    snack_reminder_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    streak_reminders_enabled: Optional[bool] = None
    streak_reminder_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    macro_adherence_reminders_enabled: Optional[bool] = None
    timezone: Optional[str] = Field(None, max_length=50)


class NotificationPreferencesResponse(BaseModel):
    notifications_enabled: bool = True
    meal_reminders_enabled: bool = True
    breakfast_reminder_time: str = "09:00"
    lunch_reminder_time: str = "13:30"
    dinner_reminder_time: str = "20:00"
    snack_reminder_time: str = "17:00"
    streak_reminders_enabled: bool = True
    streak_reminder_time: str = "21:30"
    macro_adherence_reminders_enabled: bool = True
    timezone: str = "UTC"

    model_config = ConfigDict(from_attributes=True)


class TestNotificationRequest(BaseModel):
    title: Optional[str] = "FitScan Test Notification"
    body: Optional[str] = "Push notifications are working smoothly!"
    data: Optional[Dict[str, Any]] = None


class TestNotificationResponse(BaseModel):
    success: bool = True
    dispatched_count: int = 0
    tickets: List[Dict[str, Any]] = Field(default_factory=list)


class DispatchRemindersRequest(BaseModel):
    target_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    target_date: Optional[str] = None


class DispatchRemindersResponse(BaseModel):
    success: bool = True
    processed_users: int = 0
    dispatched_notifications: int = 0
    suppressed_due_to_logging: int = 0
