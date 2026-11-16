import logging
from datetime import date
from typing import Optional, List, Dict, Any
import httpx
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import UserDevice
from app.models.settings import UserSettings
from app.models.meal import Meal
from app.services.meal_service import get_or_create_settings

logger = logging.getLogger("corecontrol.notification_service")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class NotificationService:
    @staticmethod
    async def send_push_notification(
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        db: Optional[AsyncSession] = None,
    ) -> List[Dict[str, Any]]:
        """
        Dispatch remote push notifications to Expo Push service in chunks of up to 100.
        Automatically deactivates device tokens when Expo returns 'DeviceNotRegistered'.
        """
        valid_tokens = [t.strip() for t in tokens if t and isinstance(t, str) and t.strip()]
        # Deduplicate while preserving order
        unique_tokens = list(dict.fromkeys(valid_tokens))

        if not unique_tokens:
            return []

        all_tickets: List[Dict[str, Any]] = []
        chunk_size = 100

        for i in range(0, len(unique_tokens), chunk_size):
            chunk = unique_tokens[i:i + chunk_size]
            messages = [
                {
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "channelId": "default",
                    "priority": "high",
                    "data": data or {},
                }
                for token in chunk
            ]

            headers = {
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            }

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(EXPO_PUSH_URL, json=messages, headers=headers)
                    if response.status_code == 200:
                        res_json = response.json()
                        tickets = res_json.get("data", [])
                        all_tickets.extend(tickets)

                        # Handle DeviceNotRegistered errors
                        if db is not None:
                            unregistered_tokens = []
                            for idx, ticket in enumerate(tickets):
                                if idx < len(chunk):
                                    if ticket.get("status") == "error":
                                        details = ticket.get("details", {})
                                        if details.get("error") == "DeviceNotRegistered":
                                            unregistered_tokens.append(chunk[idx])

                            if unregistered_tokens:
                                logger.info(f"Deactivating {len(unregistered_tokens)} unregistered push token(s)")
                                await db.execute(
                                    update(UserDevice)
                                    .where(UserDevice.push_token.in_(unregistered_tokens))
                                    .values(is_active=0)
                                )
                                await db.commit()
                    else:
                        logger.error(f"Expo push API returned HTTP {response.status_code}: {response.text}")
                        for _ in chunk:
                            all_tickets.append({
                                "status": "error",
                                "message": f"Expo HTTP {response.status_code}",
                            })
            except Exception as exc:
                logger.error(f"Failed to dispatch push notification to Expo: {exc}", exc_info=True)
                for _ in chunk:
                    all_tickets.append({
                        "status": "error",
                        "message": str(exc),
                    })

        return all_tickets

    @staticmethod
    async def register_or_update_device(
        db: AsyncSession,
        user_id: int,
        push_token: str,
        platform: str = "android",
        device_name: Optional[str] = None,
    ) -> UserDevice:
        """
        Upsert a device push token for a user.
        Reassigns ownership if token previously belonged to another user (e.g. account switch).
        """
        clean_token = push_token.strip()
        result = await db.execute(
            select(UserDevice).where(UserDevice.push_token == clean_token)
        )
        device = result.scalar_one_or_none()

        if device:
            device.user_id = user_id
            device.platform = platform or device.platform or "android"
            if device_name is not None:
                device.device_name = device_name
            device.is_active = 1
            device.updated_at = func.now()
        else:
            device = UserDevice(
                user_id=user_id,
                push_token=clean_token,
                platform=platform or "android",
                device_name=device_name,
                is_active=1,
            )
            db.add(device)

        await db.commit()
        await db.refresh(device)
        return device

    @staticmethod
    async def deactivate_device(db: AsyncSession, user_id: int, push_token: str) -> bool:
        """Deactivate a device push token for the current user."""
        clean_token = push_token.strip()
        result = await db.execute(
            select(UserDevice).where(
                UserDevice.push_token == clean_token,
                UserDevice.user_id == user_id,
            )
        )
        device = result.scalar_one_or_none()
        if device:
            device.is_active = 0
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_notification_preferences(db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """Fetch notification preferences from UserSettings."""
        settings = await get_or_create_settings(db, user_id)
        return {
            "notifications_enabled": bool(settings.notifications_enabled if settings.notifications_enabled is not None else 1),
            "meal_reminders_enabled": bool(settings.meal_reminders_enabled if settings.meal_reminders_enabled is not None else 1),
            "breakfast_reminder_time": settings.breakfast_reminder_time or "09:00",
            "lunch_reminder_time": settings.lunch_reminder_time or "13:30",
            "dinner_reminder_time": settings.dinner_reminder_time or "20:00",
            "snack_reminder_time": settings.snack_reminder_time or "17:00",
            "streak_reminders_enabled": bool(settings.streak_reminders_enabled if settings.streak_reminders_enabled is not None else 1),
            "streak_reminder_time": settings.streak_reminder_time or "21:30",
            "macro_adherence_reminders_enabled": bool(settings.macro_adherence_reminders_enabled if settings.macro_adherence_reminders_enabled is not None else 1),
            "timezone": settings.timezone or "UTC",
        }

    @staticmethod
    async def update_notification_preferences(
        db: AsyncSession,
        user_id: int,
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update notification preferences in UserSettings."""
        settings = await get_or_create_settings(db, user_id)

        bool_fields = [
            "notifications_enabled",
            "meal_reminders_enabled",
            "streak_reminders_enabled",
            "macro_adherence_reminders_enabled",
        ]
        for field in bool_fields:
            if field in updates and updates[field] is not None:
                setattr(settings, field, 1 if updates[field] else 0)

        str_fields = [
            "breakfast_reminder_time",
            "lunch_reminder_time",
            "dinner_reminder_time",
            "snack_reminder_time",
            "streak_reminder_time",
            "timezone",
        ]
        for field in str_fields:
            if field in updates and updates[field] is not None:
                setattr(settings, field, str(updates[field]).strip())

        await db.commit()
        await db.refresh(settings)

        return await NotificationService.get_notification_preferences(db, user_id)

    @staticmethod
    async def dispatch_scheduled_reminders(
        db: AsyncSession,
        target_time_str: Optional[str] = None,
        current_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate and dispatch scheduled meal and streak reminders.
        Suppresses meal reminders if the meal has already been logged today.
        Prompts streak reminder if 0 meals have been logged today.
        """
        if current_date is None:
            current_date = date.today()

        # Query all user settings where notifications are enabled
        settings_result = await db.execute(
            select(UserSettings).where(
                (UserSettings.notifications_enabled == 1) | (UserSettings.notifications_enabled.is_(None))
            )
        )
        all_settings = settings_result.scalars().all()

        processed_users = 0
        dispatched_notifications = 0
        suppressed_due_to_logging = 0

        for settings in all_settings:
            user_id = settings.user_id

            # Find active device tokens
            devices_result = await db.execute(
                select(UserDevice).where(
                    UserDevice.user_id == user_id,
                    UserDevice.is_active == 1,
                )
            )
            devices = devices_result.scalars().all()
            if not devices:
                continue

            device_tokens = [d.push_token for d in devices]
            processed_users += 1

            # 1. Meal Reminders
            meal_enabled = settings.meal_reminders_enabled if settings.meal_reminders_enabled is not None else 1
            if meal_enabled:
                meal_slots = [
                    (
                        "breakfast",
                        settings.breakfast_reminder_time or "09:00",
                        "Breakfast Reminder",
                        "Don't forget to fuel your morning. Tap to log your breakfast.",
                    ),
                    (
                        "lunch",
                        settings.lunch_reminder_time or "13:30",
                        "Lunch Reminder",
                        "Time for lunch! Keep your nutrition on track.",
                    ),
                    (
                        "snack",
                        settings.snack_reminder_time or "17:00",
                        "Snack Reminder",
                        "Afternoon recharge! Remember to log your snack.",
                    ),
                    (
                        "dinner",
                        settings.dinner_reminder_time or "20:00",
                        "Dinner Reminder",
                        "Wrapping up your day? Log your dinner to complete your macros.",
                    ),
                ]

                for slot_key, reminder_time, title, body in meal_slots:
                    if target_time_str is None or target_time_str == reminder_time:
                        # Check if meal was already logged for today
                        meal_check = await db.execute(
                            select(Meal.id).where(
                                Meal.user_id == user_id,
                                Meal.meal_date == current_date,
                                Meal.meal_type.ilike(slot_key),
                            ).limit(1)
                        )
                        logged_meal = meal_check.scalar_one_or_none()

                        if logged_meal is not None:
                            suppressed_due_to_logging += 1
                        else:
                            await NotificationService.send_push_notification(
                                tokens=device_tokens,
                                title=title,
                                body=body,
                                data={"screen": "Scan", "meal_type": slot_key},
                                db=db,
                            )
                            dispatched_notifications += 1

            # 2. Streak Reminders
            streak_enabled = settings.streak_reminders_enabled if settings.streak_reminders_enabled is not None else 1
            if streak_enabled:
                streak_time = settings.streak_reminder_time or "21:30"
                if target_time_str is None or target_time_str == streak_time:
                    count_check = await db.execute(
                        select(func.count(Meal.id)).where(
                            Meal.user_id == user_id,
                            Meal.meal_date == current_date,
                        )
                    )
                    meal_count = count_check.scalar_one() or 0

                    if meal_count == 0:
                        await NotificationService.send_push_notification(
                            tokens=device_tokens,
                            title="Keep Your Streak Alive",
                            body="You haven't logged any meals today. Log now to keep your streak intact!",
                            data={"screen": "Scan"},
                            db=db,
                        )
                        dispatched_notifications += 1
                    else:
                        suppressed_due_to_logging += 1

        return {
            "success": True,
            "processed_users": processed_users,
            "dispatched_notifications": dispatched_notifications,
            "suppressed_due_to_logging": suppressed_due_to_logging,
        }
