import os
import sys
from datetime import date, datetime, timezone
from unittest.mock import patch, AsyncMock
import pytest
import httpx
from sqlalchemy import select, delete

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.database import engine, Base, AsyncSessionLocal
from app.models.user import User
from app.models.device import UserDevice
from app.models.settings import UserSettings
from app.models.meal import Meal
from app.middleware.auth import get_current_user
from app.services.notification_service import NotificationService, EXPO_PUSH_URL


@pytest.fixture(autouse=True)
async def init_db_and_cleanup():
    """Ensure database schema exists and rows are cleaned up between tests."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await session.execute(delete(UserDevice))
        await session.execute(delete(Meal))
        await session.execute(delete(UserSettings))
        await session.execute(delete(User))
        await session.commit()
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(UserDevice))
        await session.execute(delete(Meal))
        await session.execute(delete(UserSettings))
        await session.execute(delete(User))
        await session.commit()


@pytest.fixture
def test_user():
    return User(
        id=501,
        email="notify_user1@fitscan.test",
        name="Notify User 1",
        created_at=datetime.now(timezone.utc),
        last_login=datetime.now(timezone.utc),
    )


@pytest.fixture
def test_user_2():
    return User(
        id=502,
        email="notify_user2@fitscan.test",
        name="Notify User 2",
        created_at=datetime.now(timezone.utc),
        last_login=datetime.now(timezone.utc),
    )


async def seed_user(user: User):
    """Seed user into database if not present."""
    async with AsyncSessionLocal() as session:
        existing = await session.get(User, user.id)
        if not existing:
            session.add(
                User(
                    id=user.id,
                    email=user.email,
                    name=user.name,
                    created_at=user.created_at,
                    last_login=user.last_login,
                )
            )
            await session.commit()


@pytest.mark.asyncio
class TestDeviceRegistration:
    async def test_register_device_token_new(self, test_user):
        """Test registering a new device token."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        payload = {
            "push_token": "ExponentPushToken[valid-test-token-1]",
            "platform": "android",
            "device_name": "Pixel 8",
        }

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/notifications/devices", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["push_token"] == "ExponentPushToken[valid-test-token-1]"
            assert data["is_active"] is True
            assert data["device_id"] > 0

        # Verify DB persistence
        async with AsyncSessionLocal() as session:
            stmt = select(UserDevice).where(UserDevice.push_token == "ExponentPushToken[valid-test-token-1]")
            device = (await session.execute(stmt)).scalar_one_or_none()
            assert device is not None
            assert device.user_id == test_user.id
            assert device.platform == "android"
            assert device.device_name == "Pixel 8"
            assert device.is_active == 1

    async def test_register_device_token_upsert_same_user(self, test_user):
        """Test re-registering an existing token for the same user updates attributes and keeps active."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        token = "ExponentPushToken[upsert-token-1]"
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # First registration
            resp1 = await client.post(
                "/api/notifications/devices",
                json={"push_token": token, "platform": "android", "device_name": "Old Name"},
            )
            assert resp1.status_code == 200
            dev_id1 = resp1.json()["device_id"]

            # Second registration with updated name
            resp2 = await client.post(
                "/api/notifications/devices",
                json={"push_token": token, "platform": "ios", "device_name": "New Name"},
            )
            assert resp2.status_code == 200
            assert resp2.json()["device_id"] == dev_id1

        async with AsyncSessionLocal() as session:
            stmt = select(UserDevice).where(UserDevice.push_token == token)
            device = (await session.execute(stmt)).scalar_one()
            assert device.device_name == "New Name"
            assert device.platform == "ios"
            assert device.is_active == 1

    async def test_register_device_token_reassign_user(self, test_user, test_user_2):
        """Test token reassignment when a new user logs in on the same physical device."""
        await seed_user(test_user)
        await seed_user(test_user_2)

        token = "ExponentPushToken[shared-device-token]"
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # User 1 registers device
            app.dependency_overrides[get_current_user] = lambda: test_user
            resp1 = await client.post("/api/notifications/devices", json={"push_token": token})
            assert resp1.status_code == 200

            # User 2 logs in on same device and registers
            app.dependency_overrides[get_current_user] = lambda: test_user_2
            resp2 = await client.post("/api/notifications/devices", json={"push_token": token})
            assert resp2.status_code == 200

        async with AsyncSessionLocal() as session:
            stmt = select(UserDevice).where(UserDevice.push_token == token)
            device = (await session.execute(stmt)).scalar_one()
            assert device.user_id == test_user_2.id
            assert device.is_active == 1

    async def test_deactivate_device_token(self, test_user):
        """Test deactivating an existing device token."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        token = "ExponentPushToken[deactivate-token-1]"
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post("/api/notifications/devices", json={"push_token": token})

            del_resp = await client.delete(f"/api/notifications/devices/{token}")
            assert del_resp.status_code == 200
            assert del_resp.json()["success"] is True

        async with AsyncSessionLocal() as session:
            stmt = select(UserDevice).where(UserDevice.push_token == token)
            device = (await session.execute(stmt)).scalar_one()
            assert device.is_active == 0

    async def test_deactivate_device_token_not_found_or_unauthorized(self, test_user, test_user_2):
        """Test 404 when deactivating non-existent token or token of another user."""
        await seed_user(test_user)
        await seed_user(test_user_2)

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # Non-existent token
            app.dependency_overrides[get_current_user] = lambda: test_user
            res404 = await client.delete("/api/notifications/devices/ExponentPushToken[non-existent]")
            assert res404.status_code == 404

            # Token registered to user 1 cannot be deleted by user 2
            token = "ExponentPushToken[user1-only-token]"
            await client.post("/api/notifications/devices", json={"push_token": token})

            app.dependency_overrides[get_current_user] = lambda: test_user_2
            unauth_res = await client.delete(f"/api/notifications/devices/{token}")
            assert unauth_res.status_code == 404


@pytest.mark.asyncio
class TestNotificationPreferences:
    async def test_get_preferences_defaults(self, test_user):
        """Test fetching default notification preferences."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/notifications/preferences")
            assert resp.status_code == 200
            data = resp.json()
            assert data["notifications_enabled"] is True
            assert data["meal_reminders_enabled"] is True
            assert data["breakfast_reminder_time"] == "09:00"
            assert data["lunch_reminder_time"] == "13:30"
            assert data["dinner_reminder_time"] == "20:00"
            assert data["snack_reminder_time"] == "17:00"
            assert data["streak_reminders_enabled"] is True
            assert data["streak_reminder_time"] == "21:30"
            assert data["macro_adherence_reminders_enabled"] is True
            assert data["timezone"] == "UTC"

    async def test_update_preferences(self, test_user):
        """Test updating notification preferences and custom reminder times."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        updates = {
            "breakfast_reminder_time": "08:15",
            "lunch_reminder_time": "12:45",
            "dinner_reminder_time": "19:30",
            "meal_reminders_enabled": False,
            "timezone": "America/New_York",
        }

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            put_resp = await client.put("/api/notifications/preferences", json=updates)
            assert put_resp.status_code == 200
            data = put_resp.json()
            assert data["breakfast_reminder_time"] == "08:15"
            assert data["lunch_reminder_time"] == "12:45"
            assert data["dinner_reminder_time"] == "19:30"
            assert data["meal_reminders_enabled"] is False
            assert data["timezone"] == "America/New_York"
            assert data["streak_reminders_enabled"] is True  # preserved default

            # Verify GET reflects persistence
            get_resp = await client.get("/api/notifications/preferences")
            assert get_resp.status_code == 200
            assert get_resp.json()["breakfast_reminder_time"] == "08:15"
            assert get_resp.json()["meal_reminders_enabled"] is False

    async def test_update_preferences_invalid_time_format(self, test_user):
        """Test rejection of invalid time formats via Pydantic regex pattern."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp1 = await client.put("/api/notifications/preferences", json={"breakfast_reminder_time": "25:00"})
            assert resp1.status_code == 422

            resp2 = await client.put("/api/notifications/preferences", json={"lunch_reminder_time": "1:30"})
            assert resp2.status_code == 422

            resp3 = await client.put("/api/notifications/preferences", json={"dinner_reminder_time": "invalid"})
            assert resp3.status_code == 422


@pytest.fixture
def mock_expo_push():
    """Mock outgoing calls to Expo push service while letting ASGI test client calls pass through."""
    original_post = httpx.AsyncClient.post

    def _setup_mock(response_data=None):
        if response_data is None:
            response_data = {"data": [{"status": "ok", "id": "ticket-default"}]}

        mock_expo_resp = httpx.Response(
            status_code=200,
            json=response_data,
            request=httpx.Request("POST", EXPO_PUSH_URL),
        )

        recorded_calls = []

        async def intercepted_post(self, url, *args, **kwargs):
            if "exp.host" in str(url):
                recorded_calls.append({"url": url, "args": args, "kwargs": kwargs})
                return mock_expo_resp
            return await original_post(self, url, *args, **kwargs)

        return patch.object(httpx.AsyncClient, "post", new=intercepted_post), recorded_calls

    return _setup_mock


@pytest.mark.asyncio
class TestPushDispatch:
    async def test_test_dispatch_no_devices(self, test_user):
        """Test immediate test push when user has no active devices."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/notifications/test-dispatch", json={})
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["dispatched_count"] == 0
            assert data["tickets"] == []

    async def test_test_dispatch_active_devices(self, test_user, mock_expo_push):
        """Test immediate test push dispatches to Expo HTTP API."""
        await seed_user(test_user)
        app.dependency_overrides[get_current_user] = lambda: test_user

        token = "ExponentPushToken[test-dispatch-token]"
        async with AsyncSessionLocal() as session:
            session.add(UserDevice(user_id=test_user.id, push_token=token, is_active=1))
            await session.commit()

        mock_patch, recorded_calls = mock_expo_push({"data": [{"status": "ok", "id": "ticket-12345"}]})

        with mock_patch:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/notifications/test-dispatch",
                    json={"title": "Custom Test", "body": "Testing 123"},
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert data["dispatched_count"] == 1
                assert data["tickets"][0]["status"] == "ok"

                assert len(recorded_calls) == 1
                call_kwargs = recorded_calls[0]["kwargs"]
                assert "json" in call_kwargs
                messages = call_kwargs["json"]
                assert len(messages) == 1
                assert messages[0]["to"] == token
                assert messages[0]["title"] == "Custom Test"
                assert messages[0]["body"] == "Testing 123"

    async def test_expo_device_not_registered_auto_deactivates(self, test_user, mock_expo_push):
        """Test that tickets with DeviceNotRegistered automatically deactivate the device token."""
        await seed_user(test_user)

        token = "ExponentPushToken[expired-token]"
        async with AsyncSessionLocal() as session:
            session.add(UserDevice(user_id=test_user.id, push_token=token, is_active=1))
            await session.commit()

        error_data = {
            "data": [
                {
                    "status": "error",
                    "message": '"ExponentPushToken[expired-token]" is not registered',
                    "details": {"error": "DeviceNotRegistered"},
                }
            ]
        }
        mock_patch, _ = mock_expo_push(error_data)

        with mock_patch:
            async with AsyncSessionLocal() as session:
                tickets = await NotificationService.send_push_notification(
                    tokens=[token],
                    title="Test",
                    body="Test",
                    db=session,
                )
                assert len(tickets) == 1
                assert tickets[0]["status"] == "error"

        # Check that token was deactivated
        async with AsyncSessionLocal() as session:
            stmt = select(UserDevice).where(UserDevice.push_token == token)
            device = (await session.execute(stmt)).scalar_one()
            assert device.is_active == 0


@pytest.mark.asyncio
class TestScheduledRemindersLogic:
    async def test_meal_reminder_suppressed_when_meal_already_logged(self, test_user):
        """When user has already logged lunch today, the lunch reminder MUST be suppressed."""
        await seed_user(test_user)
        today = date.today()

        async with AsyncSessionLocal() as session:
            # User settings: lunch reminder at 13:30
            settings = UserSettings(
                user_id=test_user.id,
                notifications_enabled=1,
                meal_reminders_enabled=1,
                lunch_reminder_time="13:30",
            )
            session.add(settings)
            # Active device
            session.add(UserDevice(user_id=test_user.id, push_token="ExponentPushToken[lunch-suppressed]", is_active=1))
            # Log lunch today
            session.add(
                Meal(
                    user_id=test_user.id,
                    meal_type="Lunch",
                    raw_input="Salad and chicken",
                    total_calories=450,
                    meal_date=today,
                )
            )
            await session.commit()

        with patch("app.services.notification_service.NotificationService.send_push_notification", new_callable=AsyncMock) as mock_send:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/notifications/dispatch-reminders",
                    json={"target_time": "13:30", "target_date": today.isoformat()},
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert data["processed_users"] == 1
                assert data["dispatched_notifications"] == 0
                assert data["suppressed_due_to_logging"] == 1
                mock_send.assert_not_awaited()

    async def test_meal_reminder_dispatched_when_meal_not_logged(self, test_user, mock_expo_push):
        """When user has NOT logged lunch today, the lunch reminder is dispatched."""
        await seed_user(test_user)
        today = date.today()

        async with AsyncSessionLocal() as session:
            settings = UserSettings(
                user_id=test_user.id,
                notifications_enabled=1,
                meal_reminders_enabled=1,
                lunch_reminder_time="13:30",
            )
            session.add(settings)
            session.add(UserDevice(user_id=test_user.id, push_token="ExponentPushToken[lunch-needed]", is_active=1))
            await session.commit()

        mock_patch, recorded_calls = mock_expo_push({"data": [{"status": "ok", "id": "ticket-lunch"}]})

        with mock_patch:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/notifications/dispatch-reminders",
                    json={"target_time": "13:30", "target_date": today.isoformat()},
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert data["processed_users"] == 1
                assert data["dispatched_notifications"] == 1
                assert data["suppressed_due_to_logging"] == 0

                assert len(recorded_calls) == 1
                call_json = recorded_calls[0]["kwargs"]["json"]
                assert call_json[0]["title"] == "Lunch Reminder"
                assert call_json[0]["data"]["meal_type"] == "lunch"

    async def test_streak_reminder_dispatched_when_zero_meals(self, test_user, mock_expo_push):
        """When user has 0 meals logged today, evening streak reminder prompts to keep streak alive."""
        await seed_user(test_user)
        today = date.today()

        async with AsyncSessionLocal() as session:
            settings = UserSettings(
                user_id=test_user.id,
                notifications_enabled=1,
                streak_reminders_enabled=1,
                streak_reminder_time="21:30",
            )
            session.add(settings)
            session.add(UserDevice(user_id=test_user.id, push_token="ExponentPushToken[streak-needed]", is_active=1))
            await session.commit()

        mock_patch, recorded_calls = mock_expo_push({"data": [{"status": "ok", "id": "ticket-streak"}]})

        with mock_patch:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/notifications/dispatch-reminders",
                    json={"target_time": "21:30", "target_date": today.isoformat()},
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["success"] is True
                assert data["dispatched_notifications"] == 1
                assert data["suppressed_due_to_logging"] == 0

                assert len(recorded_calls) == 1
                call_json = recorded_calls[0]["kwargs"]["json"]
                assert call_json[0]["title"] == "Keep Your Streak Alive"

    async def test_streak_reminder_suppressed_when_meal_logged(self, test_user):
        """When user has already logged a meal today, streak reminder is suppressed."""
        await seed_user(test_user)
        today = date.today()

        async with AsyncSessionLocal() as session:
            settings = UserSettings(
                user_id=test_user.id,
                notifications_enabled=1,
                streak_reminders_enabled=1,
                streak_reminder_time="21:30",
            )
            session.add(settings)
            session.add(UserDevice(user_id=test_user.id, push_token="ExponentPushToken[streak-safe]", is_active=1))
            # Log breakfast today
            session.add(
                Meal(
                    user_id=test_user.id,
                    meal_type="Breakfast",
                    raw_input="Oatmeal",
                    total_calories=300,
                    meal_date=today,
                )
            )
            await session.commit()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/notifications/dispatch-reminders",
                json={"target_time": "21:30", "target_date": today.isoformat()},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["dispatched_notifications"] == 0
            assert data["suppressed_due_to_logging"] == 1

    async def test_notifications_disabled_master_toggle(self, test_user):
        """When master notifications_enabled is 0, no reminders are evaluated or dispatched."""
        await seed_user(test_user)
        today = date.today()

        async with AsyncSessionLocal() as session:
            settings = UserSettings(
                user_id=test_user.id,
                notifications_enabled=0,
                meal_reminders_enabled=1,
                lunch_reminder_time="13:30",
            )
            session.add(settings)
            session.add(UserDevice(user_id=test_user.id, push_token="ExponentPushToken[master-off]", is_active=1))
            await session.commit()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/notifications/dispatch-reminders",
                json={"target_time": "13:30", "target_date": today.isoformat()},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["processed_users"] == 0
            assert data["dispatched_notifications"] == 0
