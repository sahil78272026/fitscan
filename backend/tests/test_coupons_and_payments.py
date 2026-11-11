import os
import sys
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import httpx
from sqlalchemy import select

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from pydantic import ValidationError

from app.main import app
from app.config import get_settings, Settings
from app.models.user import User
from app.models.settings import UserSettings
from app.models.coupon import Coupon, CouponRedemption
from app.models.payment import PaymentOrder
from app.middleware.auth import get_current_user
from app.services.razorpay_service import razorpay_service
from app.database import engine, Base, AsyncSessionLocal

settings = get_settings()


@pytest.fixture(autouse=True)
def setup_razorpay_mock(monkeypatch):
    """Ensure all coupon and payment tests execute predictably in mock mode."""
    monkeypatch.setattr(settings, "RAZORPAY_MOCK_MODE", True)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "mock_key_id")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "mock_secret")


@pytest.fixture(autouse=True)
async def init_db_and_cleanup():
    """Ensure database schema is created and dependencies are reset."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def test_user():
    return User(
        id=201,
        email="coupon_tester@fitscan.test",
        name="Coupon Tester",
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
    )


@pytest.fixture
def expired_user():
    return User(
        id=202,
        email="expired_buyer@fitscan.test",
        name="Expired Buyer",
        created_at=datetime.now(timezone.utc) - timedelta(days=10),
    )


@pytest.fixture
def second_user():
    return User(
        id=203,
        email="second_user@fitscan.test",
        name="Second User",
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
    )


# ============================================================================
# 1. Coupon Management & Validation Tests
# ============================================================================

class TestCouponValidationAndCreation:
    @pytest.mark.asyncio
    async def test_create_and_list_coupons(self, test_user):
        """Dynamic creation and listing of coupons via API."""
        app.dependency_overrides[get_current_user] = lambda: test_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create 100% coupon
            create_resp = await client.post(
                "/api/coupons/create",
                json={
                    "code": "LAUNCH100",
                    "description": "Launch Celebration: 1 Year Free Access",
                    "discount_percentage": 100,
                    "duration_days": 365,
                    "max_uses": 50,
                },
            )
            assert create_resp.status_code == 201
            data = create_resp.json()
            assert data["code"] == "LAUNCH100"
            assert data["discount_percentage"] == 100
            assert data["duration_days"] == 365
            assert data["max_uses"] == 50
            assert data["times_used"] == 0

            # 2. Reject duplicate code
            dup_resp = await client.post(
                "/api/coupons/create",
                json={"code": "launch100", "discount_percentage": 100},
            )
            assert dup_resp.status_code == 400
            assert "already exists" in dup_resp.json()["detail"]

            # 3. List coupons
            list_resp = await client.get("/api/coupons")
            assert list_resp.status_code == 200
            coupons = list_resp.json()
            assert any(c["code"] == "LAUNCH100" for c in coupons)

    @pytest.mark.asyncio
    async def test_validate_coupon_success(self, test_user):
        """Validating an active, non-expired coupon returns valid details."""
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="VALID50",
                description="50% Discount",
                discount_percentage=50,
                duration_days=30,
                max_uses=10,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/coupons/validate", json={"code": "valid50"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["valid"] is True
            assert data["code"] == "VALID50"
            assert data["discount_percentage"] == 50
            assert data["is_free_access"] is False

    @pytest.mark.asyncio
    async def test_validate_expired_coupon_rejected(self, test_user):
        """Expired coupons are rejected with HTTP 400."""
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="OLDEXPIRED",
                discount_percentage=100,
                valid_until=datetime.now(timezone.utc) - timedelta(days=2),
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/coupons/validate", json={"code": "OLDEXPIRED"})
            assert resp.status_code == 400
            assert "expired" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_validate_max_uses_reached_rejected(self, test_user):
        """Coupons that reached max_uses are rejected with HTTP 400."""
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="LIMITREACHED",
                discount_percentage=100,
                max_uses=2,
                times_used=2,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/coupons/validate", json={"code": "LIMITREACHED"})
            assert resp.status_code == 400
            assert "usage limit" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_validate_inactive_or_nonexistent_coupon(self, test_user):
        """Non-existent or inactive coupons return HTTP 400."""
        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/coupons/validate", json={"code": "DOESNOTEXIST"})
            assert resp.status_code == 400


# ============================================================================
# 2. Coupon Redemption & Instant 100% Pro Unlock Tests
# ============================================================================

class TestCouponRedemptionAndPaywallUnlock:
    @pytest.mark.asyncio
    async def test_100_percent_coupon_instant_unlock(self, expired_user):
        """Expired trial user redeems 100% coupon:

        - Immediately receives Pro subscription without payment gateway.
        - UserSettings updated to subscription_tier='pro', subscription_status='active_coupon'.
        - Subsequent mutating endpoints (e.g. POST /api/meals) immediately unlock!
        """
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="FREEPRO100",
                description="1 Year Free Access",
                discount_percentage=100,
                duration_days=365,
                max_uses=100,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: expired_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Before redemption, expired user is blocked on POST /api/meals
            pre_resp = await client.post("/api/meals", json={"raw_input": "2 eggs", "meal_type": "breakfast"})
            assert pre_resp.status_code == 402

            # 2. Redeem coupon
            redeem_resp = await client.post("/api/coupons/redeem", json={"code": "FREEPRO100"})
            assert redeem_resp.status_code == 200
            body = redeem_resp.json()
            assert body["success"] is True
            assert body["is_free_grant"] is True
            assert body["subscription_tier"] == "pro"
            assert body["subscription_status"] == "active_coupon"
            assert body["subscription_expires_at"] is not None

            # 3. Check status endpoint
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.status_code == 200
            status_data = status_resp.json()
            assert status_data["can_access_premium"] is True
            assert status_data["subscription_tier"] == "pro"
            assert status_data["subscription_status"] == "active_coupon"

            # 4. Mutating endpoint is now unlocked!
            mock_meal = {
                "id": 999,
                "meal_name": "Eggs",
                "meal_type": "breakfast",
                "raw_input": "2 eggs",
                "meal_date": datetime.now(timezone.utc).date().isoformat(),
                "total_calories": 140,
                "total_protein": 12.0,
                "total_carbs": 1.0,
                "total_fat": 10.0,
                "logged_at": datetime.now(timezone.utc).isoformat(),
                "food_items": [],
            }
            with patch("app.routers.meals.create_meal", new_callable=AsyncMock) as mock_create:
                mock_create.return_value = mock_meal
                post_resp = await client.post("/api/meals", json={"raw_input": "2 eggs", "meal_type": "breakfast"})
                assert post_resp.status_code == 201

    @pytest.mark.asyncio
    async def test_duplicate_coupon_redemption_prevented(self, expired_user):
        """A user cannot redeem the same coupon more than once."""
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="ONETIME100",
                discount_percentage=100,
                duration_days=30,
                max_uses=10,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: expired_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # First redemption succeeds
            resp1 = await client.post("/api/coupons/redeem", json={"code": "ONETIME100"})
            assert resp1.status_code == 200

            # Second redemption fails
            resp2 = await client.post("/api/coupons/redeem", json={"code": "ONETIME100"})
            assert resp2.status_code == 400
            assert "already redeemed" in resp2.json()["detail"].lower()

            # Validation also indicates already redeemed
            val_resp = await client.post("/api/coupons/validate", json={"code": "ONETIME100"})
            assert val_resp.status_code == 400
            assert "already redeemed" in val_resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_exhausted_coupon_redemption_rejected(self, test_user, second_user):
        """When coupon times_used reaches max_uses, subsequent users are rejected."""
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="LIMITEDONE",
                discount_percentage=100,
                duration_days=30,
                max_uses=1,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # User 1 redeems
            app.dependency_overrides[get_current_user] = lambda: test_user
            r1 = await client.post("/api/coupons/redeem", json={"code": "LIMITEDONE"})
            assert r1.status_code == 200

            # User 2 attempts to redeem exhausted coupon
            app.dependency_overrides[get_current_user] = lambda: second_user
            r2 = await client.post("/api/coupons/redeem", json={"code": "LIMITEDONE"})
            assert r2.status_code == 400
            assert "usage limit" in r2.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_partial_discount_coupon_rejected_in_redeem_endpoint(self):
        """Partial discount coupons (< 100%) must be rejected in /redeem with HTTP 400.
        They must remain unredeemed and available for checkout application.
        """
        user = User(
            id=204,
            email="partial_buyer@fitscan.test",
            name="Partial Buyer",
            created_at=datetime.now(timezone.utc) - timedelta(days=10),
        )
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="HALF50",
                description="50% Off Annual Plan",
                discount_percentage=50,
                duration_days=365,
                max_uses=10,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Direct redemption fails with 400
            resp = await client.post("/api/coupons/redeem", json={"code": "HALF50"})
            assert resp.status_code == 400
            err_detail = resp.json()["detail"]
            assert "Coupon offers a partial discount (50%)" in err_detail
            assert "Please apply it during checkout instead of direct redemption." in err_detail

            # 2. Verify coupon was NOT consumed in DB
            async with AsyncSessionLocal() as session:
                stmt_c = select(Coupon).where(Coupon.code == "HALF50")
                c_db = (await session.execute(stmt_c)).scalar_one()
                assert c_db.times_used == 0

                stmt_r = select(CouponRedemption).where(CouponRedemption.coupon_id == c_db.id)
                redemptions = (await session.execute(stmt_r)).scalars().all()
                assert len(redemptions) == 0

            # 3. User still paywalled
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.json()["can_access_premium"] is False

            # 4. Coupon can still be used during checkout to get discount!
            order_resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_annual", "coupon_code": "HALF50"},
            )
            assert order_resp.status_code == 200
            order_data = order_resp.json()
            # 999 * 50% = 499 discount -> 500 final rupees
            assert order_data["amount_rupees"] == 500
            assert order_data["amount"] == 50000


# ============================================================================
# 3. Razorpay Service & Signature Verification Unit Tests
# ============================================================================

class TestRazorpayServiceLogic:
    def test_mock_mode_detection(self):
        """Mock mode correctly activates when keys are empty or mock prefixes used."""
        assert razorpay_service.is_mock is True

    def test_create_order_mock_format(self):
        """Mock order generation produces valid Razorpay schema."""
        order = razorpay_service.create_order(amount_in_rupees=149, receipt_id="rec_123")
        assert order["id"].startswith("order_mock_")
        assert order["amount"] == 14900
        assert order["currency"] == "INR"
        assert order["receipt"] == "rec_123"
        assert order["status"] == "created"

    def test_verify_signature_mock_and_hmac(self):
        """Signature verification works for standard mock tokens and genuine HMAC."""
        # 1. Standard mock token
        assert razorpay_service.verify_payment_signature("ord_1", "pay_1", "mock_signature_valid") is True
        assert razorpay_service.verify_payment_signature("ord_1", "pay_1", "mock_signature") is True

        # 2. Genuine HMAC-SHA256
        secret = (settings.RAZORPAY_KEY_SECRET or "mock_secret").strip()
        msg = "ord_test_99|pay_test_88"
        valid_sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()
        assert razorpay_service.verify_payment_signature("ord_test_99", "pay_test_88", valid_sig) is True

        # 3. Invalid signature
        assert razorpay_service.verify_payment_signature("ord_test_99", "pay_test_88", "invalid_sig_hex") is False
        assert razorpay_service.verify_payment_signature("ord_test_99", "pay_test_88", "") is False

    def test_production_mock_mode_strictly_blocked(self):
        """Verify is_mock is strictly False in production, and Settings validates Razorpay keys."""
        # 1. is_mock returns False when APP_ENV == "production"
        with patch.object(razorpay_service.settings, "APP_ENV", "production"):
            assert razorpay_service.is_mock is False

        # 2. Placeholder key raises ValidationError in production
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                JWT_SECRET="production-secure-jwt-secret-min-32chars!",
                LOG_LEVEL="INFO",
                RAZORPAY_KEY_ID="rzp_test_replace_with_your_key_id",
                RAZORPAY_KEY_SECRET="valid_production_secret_key_12345",
            )
        assert "RAZORPAY_KEY_ID must not be empty or start with 'rzp_test_replace'" in str(exc_info.value)

        # 3. Empty key raises ValidationError in production
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                JWT_SECRET="production-secure-jwt-secret-min-32chars!",
                LOG_LEVEL="INFO",
                RAZORPAY_KEY_ID="",
                RAZORPAY_KEY_SECRET="valid_production_secret_key_12345",
            )
        assert "RAZORPAY_KEY_ID must not be empty or start with 'rzp_test_replace'" in str(exc_info.value)

        # 4. Placeholder secret raises ValidationError in production
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                JWT_SECRET="production-secure-jwt-secret-min-32chars!",
                LOG_LEVEL="INFO",
                RAZORPAY_KEY_ID="rzp_live_real_customer_key",
                RAZORPAY_KEY_SECRET="rzp_test_replace_secret",
            )
        assert "RAZORPAY_KEY_SECRET must not be empty or start with 'rzp_test_replace'" in str(exc_info.value)

        # 5. Empty secret raises ValidationError in production
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                JWT_SECRET="production-secure-jwt-secret-min-32chars!",
                LOG_LEVEL="INFO",
                RAZORPAY_KEY_ID="rzp_live_real_customer_key",
                RAZORPAY_KEY_SECRET="",
            )
        assert "RAZORPAY_KEY_SECRET must not be empty or start with 'rzp_test_replace'" in str(exc_info.value)

        # 6. Valid production keys are accepted
        valid_settings = Settings(
            APP_ENV="production",
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
            JWT_SECRET="production-secure-jwt-secret-min-32chars!",
            LOG_LEVEL="INFO",
            RAZORPAY_KEY_ID="rzp_live_real_customer_key",
            RAZORPAY_KEY_SECRET="valid_production_secret_key_12345",
        )
        assert valid_settings.RAZORPAY_KEY_ID == "rzp_live_real_customer_key"


# ============================================================================
# 4. Razorpay Endpoints: Order Creation, Payment Verification, Webhook
# ============================================================================

class TestRazorpayEndpoints:
    @pytest.mark.asyncio
    async def test_get_plans_endpoint(self):
        """GET /api/payments/plans returns pro_monthly and pro_annual."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/payments/plans")
            assert resp.status_code == 200
            plans = resp.json()["plans"]
            plan_ids = [p["id"] for p in plans]
            assert "pro_monthly" in plan_ids
            assert "pro_annual" in plan_ids

    @pytest.mark.asyncio
    async def test_create_razorpay_order_endpoint(self, test_user):
        """POST /api/payments/razorpay/create-order generates order in DB and returns mock order."""
        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_annual"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["plan_id"] == "pro_annual"
            assert data["amount"] == 99900
            assert data["amount_rupees"] == 999
            assert data["razorpay_order_id"].startswith("order_mock_")
            assert data["order_id"].startswith("po_")

    @pytest.mark.asyncio
    async def test_verify_payment_success_activates_pro(self, expired_user):
        """POST /api/payments/razorpay/verify-payment verifies signature and activates Pro."""
        app.dependency_overrides[get_current_user] = lambda: expired_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create order
            order_resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_monthly"},
            )
            assert order_resp.status_code == 200
            rzp_order_id = order_resp.json()["razorpay_order_id"]

            # 2. Verify payment with valid mock signature
            verify_resp = await client.post(
                "/api/payments/razorpay/verify-payment",
                json={
                    "razorpay_order_id": rzp_order_id,
                    "razorpay_payment_id": "pay_mock_123456",
                    "razorpay_signature": "mock_signature_valid",
                },
            )
            assert verify_resp.status_code == 200
            verify_data = verify_resp.json()
            assert verify_data["success"] is True
            assert verify_data["subscription_tier"] == "pro"
            assert verify_data["subscription_status"] == "active_paid"
            assert verify_data["subscription_expires_at"] is not None

            # 3. Idempotent re-verification
            re_verify_resp = await client.post(
                "/api/payments/razorpay/verify-payment",
                json={
                    "razorpay_order_id": rzp_order_id,
                    "razorpay_payment_id": "pay_mock_123456",
                    "razorpay_signature": "mock_signature_valid",
                },
            )
            assert re_verify_resp.status_code == 200
            assert re_verify_resp.json()["success"] is True

            # 4. Check user subscription status is active
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.status_code == 200
            assert status_resp.json()["can_access_premium"] is True
            assert status_resp.json()["subscription_tier"] == "pro"
            assert status_resp.json()["subscription_status"] == "active_paid"

    @pytest.mark.asyncio
    async def test_verify_payment_invalid_signature_rejected(self, test_user):
        """Invalid signature returns HTTP 400 and does NOT activate subscription."""
        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            order_resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_monthly"},
            )
            rzp_order_id = order_resp.json()["razorpay_order_id"]

            verify_resp = await client.post(
                "/api/payments/razorpay/verify-payment",
                json={
                    "razorpay_order_id": rzp_order_id,
                    "razorpay_payment_id": "pay_mock_123456",
                    "razorpay_signature": "invalid_signature_tampered",
                },
            )
            assert verify_resp.status_code == 400
            assert "invalid payment signature" in verify_resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_razorpay_webhook_handling(self, expired_user):
        """Webhook listener verifies signature and idempotently marks order PAID."""
        app.dependency_overrides[get_current_user] = lambda: expired_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # Create order
            order_resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_annual"},
            )
            rzp_order_id = order_resp.json()["razorpay_order_id"]

            # Webhook payload
            webhook_payload = {
                "event": "payment.captured",
                "payload": {
                    "payment": {
                        "entity": {
                            "id": "pay_hook_999",
                            "order_id": rzp_order_id,
                            "amount": 99900,
                            "currency": "INR",
                            "status": "captured",
                        }
                    }
                },
            }

            # 1. Missing header rejected
            bad_hook = await client.post("/api/payments/razorpay/webhook", json=webhook_payload)
            assert bad_hook.status_code == 400

            # 2. Valid webhook signature processes successfully
            good_hook = await client.post(
                "/api/payments/razorpay/webhook",
                json=webhook_payload,
                headers={"X-Razorpay-Signature": "mock_signature_valid"},
            )
            assert good_hook.status_code == 200
            assert good_hook.json()["status"] == "success"

            # 3. Verify user settings updated to Pro
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.status_code == 200
            assert status_resp.json()["subscription_tier"] == "pro"
            assert status_resp.json()["subscription_status"] == "active_paid"

    @pytest.mark.asyncio
    async def test_cross_user_payment_verification_forbidden(self, test_user, second_user):
        """POST /api/payments/razorpay/verify-payment rejects verification by a user
        who did not initiate the order with HTTP 403 Forbidden.
        """
        # User 1 initiates an order
        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            order_resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_monthly"},
            )
            assert order_resp.status_code == 200
            rzp_order_id = order_resp.json()["razorpay_order_id"]

            # User 2 attempts to verify User 1's order
            app.dependency_overrides[get_current_user] = lambda: second_user
            verify_resp = await client.post(
                "/api/payments/razorpay/verify-payment",
                json={
                    "razorpay_order_id": rzp_order_id,
                    "razorpay_payment_id": "pay_mock_unauthorized",
                    "razorpay_signature": "mock_signature_valid",
                },
            )
            assert verify_resp.status_code == 403
            assert "Forbidden: Order does not belong to user." in verify_resp.json()["detail"]

            # Verify User 2 did NOT get activated
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.json()["has_active_subscription"] is False

    @pytest.mark.asyncio
    async def test_webhook_coupon_reconciliation_and_null_safety(self):
        """Webhook listener safely reconciles coupon redemption when order includes coupon,
        maintains idempotency with verify-payment, and handles null payloads safely.
        """
        user = User(
            id=205,
            email="webhook_buyer@fitscan.test",
            name="Webhook Buyer",
            created_at=datetime.now(timezone.utc) - timedelta(days=10),
        )
        # 1. Create discount coupon
        async with AsyncSessionLocal() as session:
            coupon = Coupon(
                code="SAVE20",
                description="20% Off",
                discount_percentage=20,
                duration_days=30,
                max_uses=5,
                is_active=True,
            )
            session.add(coupon)
            await session.commit()

        app.dependency_overrides[get_current_user] = lambda: user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 2. Create order with coupon
            order_resp = await client.post(
                "/api/payments/razorpay/create-order",
                json={"plan_id": "pro_monthly", "coupon_code": "SAVE20"},
            )
            assert order_resp.status_code == 200
            order_data = order_resp.json()
            assert order_data["amount_rupees"] == 120  # 149 - 29 (discount) = 120
            assert order_data["amount"] == 12000
            rzp_order_id = order_data["razorpay_order_id"]

            # 3. Test null-safety: webhook with payload=None or empty
            null_hook = await client.post(
                "/api/payments/razorpay/webhook",
                json={"event": "payment.captured", "payload": None},
                headers={"X-Razorpay-Signature": "mock_signature_valid"},
            )
            assert null_hook.status_code == 200

            # 4. Process genuine webhook
            webhook_payload = {
                "event": "payment.captured",
                "payload": {
                    "payment": {
                        "entity": {
                            "id": "pay_hook_coupon_test",
                            "order_id": rzp_order_id,
                            "amount": 12000,
                            "currency": "INR",
                            "status": "captured",
                        }
                    }
                },
            }
            hook_resp = await client.post(
                "/api/payments/razorpay/webhook",
                json=webhook_payload,
                headers={"X-Razorpay-Signature": "mock_signature_valid"},
            )
            assert hook_resp.status_code == 200
            assert hook_resp.json()["status"] == "success"

            # 5. Verify coupon redemption in DB
            async with AsyncSessionLocal() as session:
                stmt_c = select(Coupon).where(Coupon.code == "SAVE20")
                c_db = (await session.execute(stmt_c)).scalar_one()
                assert c_db.times_used == 1

                stmt_r = select(CouponRedemption).where(
                    CouponRedemption.coupon_id == c_db.id,
                    CouponRedemption.user_id == user.id,
                )
                red = (await session.execute(stmt_r)).scalar_one_or_none()
                assert red is not None
                assert red.discount_applied == 20

            # 6. Verify user subscription is activated
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.status_code == 200
            assert status_resp.json()["subscription_tier"] == "pro"
            assert status_resp.json()["subscription_status"] == "active_paid"

            # 7. Subsequent client verify-payment call must be idempotent (no double redemption)
            verify_resp = await client.post(
                "/api/payments/razorpay/verify-payment",
                json={
                    "razorpay_order_id": rzp_order_id,
                    "razorpay_payment_id": "pay_hook_coupon_test",
                    "razorpay_signature": "mock_signature_valid",
                },
            )
            assert verify_resp.status_code == 200

            async with AsyncSessionLocal() as session:
                stmt_c = select(Coupon).where(Coupon.code == "SAVE20")
                c_db = (await session.execute(stmt_c)).scalar_one()
                assert c_db.times_used == 1  # Still 1, not incremented again!

    @pytest.mark.asyncio
    async def test_testfree_auto_seed_and_redeem(self, test_user):
        """Verify TESTFREE coupon is auto-created on demand and activates 100% free Pro access."""
        app.dependency_overrides[get_current_user] = lambda: test_user
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Validate TESTFREE without prior database entry
            val_resp = await client.post(
                "/api/coupons/validate",
                json={"code": "TESTFREE", "plan_type": "annual"},
            )
            assert val_resp.status_code == 200
            val_data = val_resp.json()
            assert val_data["valid"] is True
            assert val_data["discount_percentage"] == 100
            assert val_data["is_free_access"] is True

            # 2. Redeem TESTFREE directly
            redeem_resp = await client.post(
                "/api/coupons/redeem",
                json={"code": "TESTFREE", "plan_type": "annual"},
            )
            assert redeem_resp.status_code == 200
            redeem_data = redeem_resp.json()
            assert redeem_data["success"] is True
            assert redeem_data["subscription_tier"] == "pro"
            assert redeem_data["subscription_status"] == "active_coupon"

            # 3. Check status endpoint confirms Pro tier
            status_resp = await client.get("/api/subscription/status")
            assert status_resp.status_code == 200
            status_data = status_resp.json()
            assert status_data["subscription_tier"] == "pro"
            assert status_data["can_access_premium"] is True

