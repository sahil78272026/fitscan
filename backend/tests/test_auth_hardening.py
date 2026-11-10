import os
import sys
from unittest.mock import patch
import pytest
import httpx
from pydantic import ValidationError

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.config import Settings
from app.database import engine, Base
from app.services.auth_service import verify_otp, generate_otp


@pytest.fixture(autouse=True)
async def init_db_and_cleanup():
    """Ensure database schema is created and dependencies are reset."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


# ============================================================================
# 1. Email Login Backdoor Closure Tests
# ============================================================================

class TestEmailLoginHardening:
    @pytest.mark.asyncio
    async def test_email_login_forbidden_in_production(self):
        """Verify POST /api/auth/email-login returns 403 Forbidden when APP_ENV=production."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.routers.auth.get_settings") as mock_settings:
                mock_settings.return_value = Settings(
                    APP_ENV="production",
                    DATABASE_URL="sqlite:///:memory:",
                    GEMINI_API_KEY="test_key",
                    JWT_SECRET="secure-production-jwt-secret-key-32chars!",
                    LOG_LEVEL="INFO",
                    RAZORPAY_KEY_ID="rzp_live_testkey12345",
                    RAZORPAY_KEY_SECRET="test_live_secret12345",
                )
                payload = {
                    "email": "attacker@example.com",
                    "name": "Attacker",
                }
                resp = await client.post("/api/auth/email-login", json=payload)
                assert resp.status_code == 403
                data = resp.json()
                assert "Direct email login is disabled in production" in data["detail"]
                assert "Firebase Authentication" in data["detail"]

    @pytest.mark.asyncio
    async def test_email_login_works_in_development(self):
        """Verify POST /api/auth/email-login returns 200 OK and valid session when APP_ENV=development."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.routers.auth.get_settings") as mock_settings:
                mock_settings.return_value = Settings(
                    APP_ENV="development",
                    DATABASE_URL="sqlite:///:memory:",
                    GEMINI_API_KEY="test_key",
                )
                payload = {
                    "email": "devuser@fitscan.app",
                    "name": "Dev User",
                }
                resp = await client.post("/api/auth/email-login", json=payload)
                assert resp.status_code == 200
                data = resp.json()
                assert "token" in data
                assert data["user"]["email"] == "devuser@fitscan.app"
                assert "is_new_user" in data


# ============================================================================
# 2. DEV_OTP Bypass Closure Tests
# ============================================================================

class TestDevOTPHardening:
    def test_dev_otp_setting_rejected_in_production(self):
        """Verify non-empty DEV_OTP raises ValidationError in production Settings."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                DEV_OTP="123456",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                JWT_SECRET="secure-production-jwt-secret-key-32chars!",
                LOG_LEVEL="INFO",
            )
        assert "DEV_OTP must be empty" in str(exc_info.value)

    def test_dev_otp_rejected_in_production(self):
        """Verify DEV_OTP (123456) is rejected in verify_otp when APP_ENV=production."""
        with patch("app.services.auth_service.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                APP_ENV="production",
                DEV_OTP="",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                JWT_SECRET="secure-production-jwt-secret-key-32chars!",
                LOG_LEVEL="INFO",
                RAZORPAY_KEY_ID="rzp_live_testkey12345",
                RAZORPAY_KEY_SECRET="test_live_secret12345",
            )
            # Both configured DEV_OTP and hardcoded 123456 must be rejected
            assert verify_otp("+1234567890", "123456") is False
            assert verify_otp("+9876543210", "123456") is False

    @pytest.mark.asyncio
    async def test_verify_otp_endpoint_rejects_dev_otp_in_production(self):
        """Verify POST /api/auth/verify-otp returns 400 when attempting DEV_OTP in production."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.services.auth_service.get_settings") as mock_settings:
                mock_settings.return_value = Settings(
                    APP_ENV="production",
                    DEV_OTP="",
                    DATABASE_URL="sqlite:///:memory:",
                    GEMINI_API_KEY="test_key",
                    JWT_SECRET="secure-production-jwt-secret-key-32chars!",
                    LOG_LEVEL="INFO",
                    RAZORPAY_KEY_ID="rzp_live_testkey12345",
                    RAZORPAY_KEY_SECRET="test_live_secret12345",
                )
                payload = {
                    "phone": "+19998887777",
                    "otp": "123456",
                    "name": "Production User",
                }
                resp = await client.post("/api/auth/verify-otp", json=payload)
                assert resp.status_code == 400
                assert resp.json()["detail"] == "Invalid or expired OTP"

    @pytest.mark.asyncio
    async def test_send_otp_endpoint_forbidden_in_production(self):
        """Verify POST /api/auth/send-otp returns 403 Forbidden when APP_ENV=production."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.routers.auth.get_settings") as mock_settings:
                mock_settings.return_value = Settings(
                    APP_ENV="production",
                    DEV_OTP="",
                    DATABASE_URL="sqlite:///:memory:",
                    GEMINI_API_KEY="test_key",
                    JWT_SECRET="secure-production-jwt-secret-key-32chars!",
                    LOG_LEVEL="INFO",
                    RAZORPAY_KEY_ID="rzp_live_testkey12345",
                    RAZORPAY_KEY_SECRET="test_live_secret12345",
                )
                payload = {"phone": "+19998887777"}
                resp = await client.post("/api/auth/send-otp", json=payload)
                assert resp.status_code == 403
                assert "Dev OTP generation is disabled in production" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_send_otp_endpoint_allowed_in_development(self):
        """Verify POST /api/auth/send-otp returns 200 OK when APP_ENV=development."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.routers.auth.get_settings") as mock_settings:
                mock_settings.return_value = Settings(
                    APP_ENV="development",
                    DEV_OTP="123456",
                    DATABASE_URL="sqlite:///:memory:",
                    GEMINI_API_KEY="test_key",
                )
                payload = {"phone": "+15551234567"}
                resp = await client.post("/api/auth/send-otp", json=payload)
                assert resp.status_code == 200
                assert resp.json()["phone"] == "+15551234567"

    def test_dev_otp_accepted_in_development(self):
        """Verify DEV_OTP (123456) is accepted in verify_otp when APP_ENV=development."""
        with patch("app.services.auth_service.get_settings") as mock_settings:
            mock_settings.return_value = Settings(
                APP_ENV="development",
                DEV_OTP="123456",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
            )
            assert verify_otp("+1234567890", "123456") is True

    @pytest.mark.asyncio
    async def test_verify_otp_endpoint_accepts_dev_otp_in_development(self):
        """Verify POST /api/auth/verify-otp succeeds with DEV_OTP in development."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.services.auth_service.get_settings") as mock_settings:
                mock_settings.return_value = Settings(
                    APP_ENV="development",
                    DEV_OTP="123456",
                    DATABASE_URL="sqlite:///:memory:",
                    GEMINI_API_KEY="test_key",
                )
                payload = {
                    "phone": "+15551234567",
                    "otp": "123456",
                    "name": "Dev Phone User",
                }
                resp = await client.post("/api/auth/verify-otp", json=payload)
                assert resp.status_code == 200
                data = resp.json()
                assert "token" in data
                assert data["user"]["phone"] == "+15551234567"


# ============================================================================
# 3. Environment & Configuration Hardening Tests
# ============================================================================

class TestConfigJWTSecretHardening:
    def test_default_jwt_secret_rejected_in_production(self):
        """Verify default JWT_SECRET ('dev-secret-change-in-production') raises ValidationError in production."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                JWT_SECRET="dev-secret-change-in-production",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                LOG_LEVEL="INFO",
            )
        error_msg = str(exc_info.value)
        assert "JWT_SECRET must not be empty, whitespace, or default" in error_msg
        assert "at least 32 characters long" in error_msg

    def test_empty_jwt_secret_rejected_in_production(self):
        """Verify empty JWT_SECRET raises ValidationError in production."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                JWT_SECRET="",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                LOG_LEVEL="INFO",
            )
        error_msg = str(exc_info.value)
        assert "JWT_SECRET must not be empty, whitespace, or default" in error_msg

    @pytest.mark.parametrize("ws_secret", ["   ", "\t\n", " \t \n "])
    def test_whitespace_jwt_secret_rejected_in_production(self, ws_secret: str):
        """Verify whitespace JWT_SECRET raises ValidationError in production."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                JWT_SECRET=ws_secret,
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                LOG_LEVEL="INFO",
            )
        error_msg = str(exc_info.value)
        assert "JWT_SECRET must not be empty, whitespace, or default" in error_msg

    def test_padded_default_jwt_secret_rejected_in_production(self):
        """Verify whitespace-padded default JWT_SECRET raises ValidationError in production."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                JWT_SECRET="   dev-secret-change-in-production   ",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                LOG_LEVEL="INFO",
            )
        error_msg = str(exc_info.value)
        assert "JWT_SECRET must not be empty, whitespace, or default" in error_msg

    @pytest.mark.parametrize("short_secret", [
        "short",
        "secret-key-16-ch",
        "a" * 31,
    ])
    def test_short_jwt_secret_rejected_in_production(self, short_secret: str):
        """Verify JWT_SECRET shorter than 32 characters raises ValidationError in production."""
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                JWT_SECRET=short_secret,
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                LOG_LEVEL="INFO",
            )
        error_msg = str(exc_info.value)
        assert "at least 32 characters long" in error_msg

    def test_secure_jwt_secret_accepted_in_production(self):
        """Verify a secure, custom JWT_SECRET is accepted in production."""
        secure_secret = "a-very-long-production-grade-jwt-secret-key-32-chars-minimum"
        s = Settings(
            APP_ENV="production",
            JWT_SECRET=secure_secret,
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
            LOG_LEVEL="INFO",
            RAZORPAY_KEY_ID="rzp_live_testkey12345",
            RAZORPAY_KEY_SECRET="test_live_secret12345",
        )
        assert s.JWT_SECRET == secure_secret
        assert s.APP_ENV == "production"

    def test_padded_secure_jwt_secret_accepted_in_production(self):
        """Verify a secure JWT_SECRET with surrounding whitespace is stripped and accepted in production."""
        raw_secret = "   a-very-long-production-grade-jwt-secret-key-32-chars-minimum   "
        s = Settings(
            APP_ENV="production",
            JWT_SECRET=raw_secret,
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
            LOG_LEVEL="INFO",
            RAZORPAY_KEY_ID="rzp_live_testkey12345",
            RAZORPAY_KEY_SECRET="test_live_secret12345",
        )
        assert s.JWT_SECRET == raw_secret.strip()
        assert s.APP_ENV == "production"

    def test_default_jwt_secret_allowed_in_development(self):
        """Verify default JWT_SECRET is permitted when APP_ENV=development."""
        s = Settings(
            APP_ENV="development",
            JWT_SECRET="dev-secret-change-in-production",
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
        )
        assert s.JWT_SECRET == "dev-secret-change-in-production"
        assert s.APP_ENV == "development"
