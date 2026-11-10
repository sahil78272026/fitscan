import os
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
import httpx
from fastapi import HTTPException

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.models.user import User
from app.models.settings import UserSettings
from app.middleware.auth import get_current_user, require_active_subscription
from app.services.subscription_service import get_subscription_status, TRIAL_PERIOD_DAYS
from app.database import get_db, engine, Base, AsyncSessionLocal


@pytest.fixture(autouse=True)
async def init_db_and_cleanup():
    """Ensure database schema is created and dependencies are reset."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def active_trial_user():
    return User(
        id=101,
        email="active_trial@fitscan.test",
        name="Active Trial User",
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
    )


@pytest.fixture
def expired_trial_user():
    return User(
        id=102,
        email="expired_trial@fitscan.test",
        name="Expired Trial User",
        created_at=datetime.now(timezone.utc) - timedelta(days=8),
    )


@pytest.fixture
def pro_user_with_expired_trial():
    return User(
        id=103,
        email="pro_user@fitscan.test",
        name="Pro Subscriber",
        created_at=datetime.now(timezone.utc) - timedelta(days=30),
    )


# ============================================================================
# 1. Unit Tests for Subscription Calculation Service
# ============================================================================

class TestSubscriptionServiceMath:
    def test_trial_active_math(self, active_trial_user):
        """A user registered 2 days ago should have active trial with ~5 days remaining."""
        sub = get_subscription_status(active_trial_user)
        assert sub["is_trial_active"] is True
        assert sub["can_access_premium"] is True
        assert sub["has_active_subscription"] is False
        assert sub["subscription_tier"] == "trial"
        assert sub["subscription_status"] == "trial_active"
        assert sub["trial_days_remaining"] >= 4
        assert sub["trial_hours_remaining"] > 0
        assert sub["subscription_expires_at"] is None

    def test_trial_expired_math(self, expired_trial_user):
        """A user registered 8 days ago should have expired trial and 0 days remaining."""
        sub = get_subscription_status(expired_trial_user)
        assert sub["is_trial_active"] is False
        assert sub["can_access_premium"] is False
        assert sub["has_active_subscription"] is False
        assert sub["subscription_tier"] == "expired"
        assert sub["subscription_status"] == "trial_expired"
        assert sub["trial_days_remaining"] == 0
        assert sub["trial_hours_remaining"] == 0

    def test_legacy_user_none_created_at(self):
        """A legacy user with created_at=None should gracefully default to now (active trial)."""
        user = User(id=104, email="legacy@fitscan.test", name="Legacy User")
        user.created_at = None
        sub = get_subscription_status(user)
        assert sub["is_trial_active"] is True
        assert sub["can_access_premium"] is True
        assert sub["subscription_tier"] == "trial"
        assert sub["trial_days_remaining"] == 7 or sub["trial_days_remaining"] == 6

    def test_timezone_naive_created_at_handled_safely(self):
        """Naive datetime from SQLite must be safely converted to UTC without raising TypeError."""
        naive_dt = datetime.now() - timedelta(days=1)
        user = User(id=105, email="naive@fitscan.test", name="Naive DT User")
        user.created_at = naive_dt

        sub = get_subscription_status(user)
        assert sub["is_trial_active"] is True
        assert sub["can_access_premium"] is True
        assert sub["trial_ends_at"].tzinfo is not None

    def test_pro_user_with_expired_trial_retains_access(self, pro_user_with_expired_trial):
        """A user past the 7-day trial who holds an active pro subscription must retain access."""
        future_expiry = datetime.now(timezone.utc) + timedelta(days=30)
        settings = UserSettings(
            user_id=pro_user_with_expired_trial.id,
            subscription_tier="pro",
            subscription_status="active_paid",
            subscription_expires_at=future_expiry,
        )

        sub = get_subscription_status(pro_user_with_expired_trial, settings)
        assert sub["is_trial_active"] is False
        assert sub["has_active_subscription"] is True
        assert sub["can_access_premium"] is True
        assert sub["subscription_tier"] == "pro"
        assert sub["subscription_status"] == "active_paid"
        assert sub["subscription_expires_at"] == future_expiry

    def test_pro_user_with_expired_subscription_and_trial_blocked(self, pro_user_with_expired_trial):
        """A user whose pro subscription expired and trial has expired must be blocked."""
        past_expiry = datetime.now(timezone.utc) - timedelta(days=1)
        settings = UserSettings(
            user_id=pro_user_with_expired_trial.id,
            subscription_tier="pro",
            subscription_status="active_paid",
            subscription_expires_at=past_expiry,
        )

        sub = get_subscription_status(pro_user_with_expired_trial, settings)
        assert sub["is_trial_active"] is False
        assert sub["has_active_subscription"] is False
        assert sub["can_access_premium"] is False
        assert sub["subscription_tier"] == "expired"
        assert sub["subscription_status"] == "trial_expired"


# ============================================================================
# 2. Unit Tests for require_active_subscription Dependency
# ============================================================================

class TestRequireActiveSubscriptionDependency:
    @pytest.mark.asyncio
    async def test_dependency_allows_active_trial_user(self, active_trial_user):
        """User with active trial passes through require_active_subscription."""
        async with AsyncSessionLocal() as session:
            user = await require_active_subscription(current_user=active_trial_user, db=session)
            assert user.id == active_trial_user.id

    @pytest.mark.asyncio
    async def test_dependency_raises_402_on_expired_trial(self, expired_trial_user):
        """User with expired trial and no subscription gets HTTP 402 with structured detail."""
        async with AsyncSessionLocal() as session:
            with pytest.raises(HTTPException) as exc_info:
                await require_active_subscription(current_user=expired_trial_user, db=session)

            exc = exc_info.value
            assert exc.status_code == 402
            assert isinstance(exc.detail, dict)
            assert exc.detail["code"] == "TRIAL_EXPIRED"
            assert exc.detail["subscription_status"] == "trial_expired"
            assert exc.detail["trial_days_remaining"] == 0
            assert "7-day free trial has expired" in exc.detail["message"]


# ============================================================================
# 3. HTTP Tests for /api/subscription/status Endpoint
# ============================================================================

class TestSubscriptionStatusEndpoint:
    @pytest.mark.asyncio
    async def test_subscription_status_endpoint_active_user(self, active_trial_user):
        """GET /api/subscription/status returns 200 with active trial details."""
        app.dependency_overrides[get_current_user] = lambda: active_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/subscription/status")
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_trial_active"] is True
            assert data["can_access_premium"] is True
            assert data["subscription_tier"] == "trial"
            assert data["subscription_status"] == "trial_active"
            assert "trial_ends_at" in data

    @pytest.mark.asyncio
    async def test_subscription_status_endpoint_expired_user(self, expired_trial_user):
        """GET /api/subscription/status returns 200 with expired status for paywalled users."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/subscription/status")
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_trial_active"] is False
            assert data["can_access_premium"] is False
            assert data["subscription_tier"] == "expired"
            assert data["subscription_status"] == "trial_expired"


# ============================================================================
# 4. Paywall Gating Tests: Active/Mutating Endpoints return HTTP 402
# ============================================================================

class TestPaywallGatingOnMutatingEndpoints:
    @pytest.mark.asyncio
    async def test_expired_user_blocked_on_log_meal(self, expired_trial_user):
        """POST /api/meals is blocked with HTTP 402 for expired trial accounts."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/meals", json={"raw_input": "2 eggs and toast", "meal_type": "breakfast"})
            assert resp.status_code == 402
            body = resp.json()
            assert body["detail"]["code"] == "TRIAL_EXPIRED"
            assert "expired" in body["detail"]["message"].lower()

    @pytest.mark.asyncio
    async def test_expired_user_blocked_on_scan_image_base64(self, expired_trial_user):
        """POST /api/meals/scan-image-base64 is blocked with HTTP 402."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/meals/scan-image-base64",
                json={
                    "photo_base64": "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
                    "raw_input": "Food scan",
                    "meal_type": "lunch",
                },
            )
            assert resp.status_code == 402
            assert resp.json()["detail"]["code"] == "TRIAL_EXPIRED"

    @pytest.mark.asyncio
    async def test_expired_user_blocked_on_meal_plan_suggest(self, expired_trial_user):
        """POST /api/settings/meal-plans/suggest is blocked with HTTP 402."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/settings/meal-plans/suggest")
            assert resp.status_code == 402
            assert resp.json()["detail"]["code"] == "TRIAL_EXPIRED"

    @pytest.mark.asyncio
    async def test_expired_user_blocked_on_log_weight(self, expired_trial_user):
        """POST /api/weight is blocked with HTTP 402."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/weight", json={"weight_kg": 75.5})
            assert resp.status_code == 402
            assert resp.json()["detail"]["code"] == "TRIAL_EXPIRED"

    @pytest.mark.asyncio
    async def test_expired_user_blocked_on_log_steps(self, expired_trial_user):
        """POST /api/steps is blocked with HTTP 402."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/steps", json={"step_count": 5000})
            assert resp.status_code == 402
            assert resp.json()["detail"]["code"] == "TRIAL_EXPIRED"


# ============================================================================
# 5. Read-Access Preservation Tests: Expired User CAN Read Historical Data
# ============================================================================

class TestReadEndpointPreservationForExpiredUser:
    @pytest.mark.asyncio
    async def test_expired_user_can_read_meals_today(self, expired_trial_user):
        """GET /api/meals/today must succeed with HTTP 200 for expired accounts."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        with patch("app.routers.meals.get_meals_by_date", new_callable=AsyncMock) as mock_get_meals:
            mock_get_meals.return_value = []
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/meals/today")
                assert resp.status_code == 200
                assert resp.json() == []

    @pytest.mark.asyncio
    async def test_expired_user_can_read_settings(self, expired_trial_user):
        """GET /api/settings must succeed with HTTP 200 for expired accounts."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/settings")
            assert resp.status_code == 200
            data = resp.json()
            assert "calorie_goal" in data

    @pytest.mark.asyncio
    async def test_expired_user_can_read_weight_history(self, expired_trial_user):
        """GET /api/weight/history must succeed with HTTP 200 for expired accounts."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/weight/history")
            assert resp.status_code == 200
            data = resp.json()
            assert "logs" in data

    @pytest.mark.asyncio
    async def test_expired_user_can_read_steps_daily(self, expired_trial_user):
        """GET /api/steps/daily must succeed with HTTP 200 for expired accounts."""
        app.dependency_overrides[get_current_user] = lambda: expired_trial_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/steps/daily")
            assert resp.status_code == 200
            data = resp.json()
            assert "step_count" in data
