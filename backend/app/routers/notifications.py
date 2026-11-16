import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.device import UserDevice
from app.middleware.auth import get_current_user
from app.schemas.notification import (
    DeviceTokenRegister,
    DeviceTokenResponse,
    NotificationPreferencesUpdate,
    NotificationPreferencesResponse,
    TestNotificationRequest,
    TestNotificationResponse,
    DispatchRemindersRequest,
    DispatchRemindersResponse,
)
from app.services.notification_service import NotificationService

logger = logging.getLogger("corecontrol.routers.notifications")

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.post("/devices", response_model=DeviceTokenResponse, status_code=status.HTTP_200_OK)
async def register_device(
    payload: DeviceTokenRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register or reactivate an Expo push device token for the authenticated user."""
    device = await NotificationService.register_or_update_device(
        db=db,
        user_id=current_user.id,
        push_token=payload.push_token,
        platform=payload.platform or "android",
        device_name=payload.device_name,
    )
    return DeviceTokenResponse(
        success=True,
        device_id=device.id,
        push_token=device.push_token,
        is_active=bool(device.is_active),
    )


@router.delete("/devices/{push_token}", status_code=status.HTTP_200_OK)
async def deactivate_device(
    push_token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate an Expo push token for the authenticated user."""
    deactivated = await NotificationService.deactivate_device(
        db=db,
        user_id=current_user.id,
        push_token=push_token,
    )
    if not deactivated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device token not found for this user",
        )
    return {"success": True, "message": "Device token deactivated successfully"}


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notification preferences and customizable meal reminder times."""
    prefs = await NotificationService.get_notification_preferences(db=db, user_id=current_user.id)
    return NotificationPreferencesResponse(**prefs)


@router.put("/preferences", response_model=NotificationPreferencesResponse)
async def update_preferences(
    payload: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update notification preferences and customizable reminder times."""
    updates = payload.model_dump(exclude_unset=True)
    prefs = await NotificationService.update_notification_preferences(
        db=db,
        user_id=current_user.id,
        updates=updates,
    )
    return NotificationPreferencesResponse(**prefs)


@router.post("/test-dispatch", response_model=TestNotificationResponse)
async def test_dispatch(
    payload: Optional[TestNotificationRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send an immediate test push notification to all active devices of the current user."""
    devices_result = await db.execute(
        select(UserDevice).where(
            UserDevice.user_id == current_user.id,
            UserDevice.is_active == 1,
        )
    )
    devices = devices_result.scalars().all()
    tokens = [d.push_token for d in devices]

    if not tokens:
        return TestNotificationResponse(
            success=True,
            dispatched_count=0,
            tickets=[],
        )

    title = payload.title if payload and payload.title else "FitScan Test Notification"
    body = payload.body if payload and payload.body else "Push notifications are working smoothly!"
    data = payload.data if payload and payload.data is not None else {"screen": "Today", "type": "test"}

    tickets = await NotificationService.send_push_notification(
        tokens=tokens,
        title=title,
        body=body,
        data=data,
        db=db,
    )

    return TestNotificationResponse(
        success=True,
        dispatched_count=len(tickets),
        tickets=tickets,
    )


@router.post("/dispatch-reminders", response_model=DispatchRemindersResponse)
async def dispatch_reminders(
    payload: Optional[DispatchRemindersRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger scheduled reminder dispatch for meal and streak reminders.
    Optionally filter by target_time (e.g. '13:30') or target_date ('YYYY-MM-DD').
    """
    target_time_str = payload.target_time if payload else None
    target_date = None
    if payload and payload.target_date:
        try:
            target_date = date.fromisoformat(payload.target_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid target_date format. Must be YYYY-MM-DD.",
            )

    result = await NotificationService.dispatch_scheduled_reminders(
        db=db,
        target_time_str=target_time_str,
        current_date=target_date,
    )
    return DispatchRemindersResponse(**result)
