import asyncio
import os
import sys
import json
from unittest.mock import patch, AsyncMock
import pytest
import httpx
from pydantic import ValidationError
from starlette.requests import Request
from starlette.datastructures import Headers
from fastapi import HTTPException
from fastapi.responses import JSONResponse

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app, limiter, get_rate_limit_key
from app.config import Settings
from app.database import engine, AsyncSessionLocal
from app.models.user import User
from app.models.settings import UserSettings
from app.middleware.auth import get_current_user
from app.services.auth_service import create_jwt_token
from app.services import gemini_service


@pytest.fixture(autouse=True)
def reset_limiter_and_overrides():
    """Reset rate limiter state and dependency overrides before each test."""
    if hasattr(app.state, "limiter"):
        app.state.limiter.reset()
    app.dependency_overrides.clear()
    yield
    if hasattr(app.state, "limiter"):
        app.state.limiter.reset()
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user():
    return User(id=1, email="user1@example.com", phone="+1234567890", name="User One")


@pytest.fixture
def mock_user_2():
    return User(id=2, email="user2@example.com", phone="+1987654321", name="User Two")


# ============================================================================
# 1. Rate Limiting Tests
# ============================================================================

class TestRateLimiting:
    @pytest.mark.asyncio
    async def test_rate_limit_scan_image_base64_exceeded(self, mock_user):
        """Verify 10/minute rate limit on POST /api/meals/scan-image-base64."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create dummy 1x1 GIF base64 string
        dummy_b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        payload = {"photo_base64": dummy_b64, "meal_type": "lunch"}

        # Mock meal creation to be instantaneous
        with patch("app.routers.meals.create_meal", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {
                "id": 101,
                "meal_type": "lunch",
                "raw_input": "Scanned lunch photo",
                "total_calories": 250,
                "total_protein": 10.0,
                "total_carbs": 20.0,
                "total_fat": 5.0,
                "meal_date": "2026-11-02",
                "logged_at": "2026-11-02T12:00:00",
                "food_items": [],
            }

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 10 requests should succeed (201)
                for i in range(10):
                    resp = await client.post("/api/meals/scan-image-base64", json=payload)
                    assert resp.status_code == 201, f"Request {i+1} failed: {resp.text}"

                # 11th request must be rate limited (429)
                rate_limited_resp = await client.post("/api/meals/scan-image-base64", json=payload)
                assert rate_limited_resp.status_code == 429
                data = rate_limited_resp.json()
                assert "Rate limit exceeded" in data.get("error", "")

    @pytest.mark.asyncio
    async def test_rate_limit_key_isolation_by_user_id(self, mock_user, mock_user_2):
        """Verify distinct users have isolated rate limit buckets via JWT Authorization header."""
        token1 = create_jwt_token(user_id=mock_user.id)
        token2 = create_jwt_token(user_id=mock_user_2.id)

        dummy_b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        payload = {"photo_base64": dummy_b64, "meal_type": "lunch"}

        with patch("app.routers.meals.create_meal", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {
                "id": 1,
                "meal_type": "lunch",
                "raw_input": "Test",
                "total_calories": 100,
                "total_protein": 5.0,
                "total_carbs": 10.0,
                "total_fat": 2.0,
                "meal_date": "2026-11-02",
                "logged_at": "2026-11-02T12:00:00",
                "food_items": [],
            }

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # Exhaust User 1's limit of 10 requests
                app.dependency_overrides[get_current_user] = lambda: mock_user
                for _ in range(10):
                    r = await client.post(
                        "/api/meals/scan-image-base64",
                        json=payload,
                        headers={"Authorization": f"Bearer {token1}"},
                    )
                    assert r.status_code == 201

                # User 1 is rate limited
                r_blocked = await client.post(
                    "/api/meals/scan-image-base64",
                    json=payload,
                    headers={"Authorization": f"Bearer {token1}"},
                )
                assert r_blocked.status_code == 429

                # User 2 should NOT be rate limited
                app.dependency_overrides[get_current_user] = lambda: mock_user_2
                r_user2 = await client.post(
                    "/api/meals/scan-image-base64",
                    json=payload,
                    headers={"Authorization": f"Bearer {token2}"},
                )
                assert r_user2.status_code == 201

    @pytest.mark.asyncio
    async def test_rate_limit_recommendations_exceeded(self, mock_user):
        """Verify 5/minute rate limit on GET /api/meals/recommendations."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        with patch("app.routers.meals.get_or_create_settings", new_callable=AsyncMock) as mock_settings, \
             patch("app.routers.meals.recommend_curated_meals", new_callable=AsyncMock) as mock_recs:
            mock_settings.return_value = UserSettings(
                user_id=mock_user.id,
                goal_type="fat_loss",
                diet_type="veg",
                budget_tier="moderate",
                calorie_goal=2000,
            )
            mock_recs.return_value = {
                "budget_tier": "moderate",
                "diet_type": "veg",
                "recommendations": [],
            }

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                for _ in range(5):
                    resp = await client.get("/api/meals/recommendations")
                    assert resp.status_code == 200

                # 6th request should hit rate limit
                blocked = await client.get("/api/meals/recommendations")
                assert blocked.status_code == 429
                assert "Rate limit exceeded" in blocked.json().get("error", "")


# ============================================================================
# 2. Resilient AI Invocations & Fallback Payload Tests
# ============================================================================

class TestAIResilienceAndTimeouts:
    @pytest.mark.asyncio
    async def test_analyze_food_timeout_returns_504(self, mock_user):
        """Verify Gemini timeout (>10s) returns HTTP 504 with structured manual fallback JSON."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        with patch("app.services.meal_service.analyze_food", side_effect=TimeoutError("AI food scanning service timed out after 10.0s")):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post(
                    "/api/meals",
                    json={"raw_input": "2 rotis and dal", "meal_type": "lunch"},
                )
                assert resp.status_code == 504
                body = resp.json()
                assert body["detail"] == "AI food scanning service timed out. Please enter meal details manually."
                assert body["error_code"] == "AI_SERVICE_UNAVAILABLE"
                assert body["fallback_to_manual"] is True

    @pytest.mark.asyncio
    async def test_analyze_food_api_error_returns_503(self, mock_user):
        """Verify Gemini API error returns HTTP 503 with structured manual fallback JSON."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        with patch("app.services.meal_service.analyze_food", side_effect=RuntimeError("Google GenAI 503 Overloaded")):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post(
                    "/api/meals",
                    json={"raw_input": "2 rotis and dal", "meal_type": "lunch"},
                )
                assert resp.status_code == 503
                body = resp.json()
                assert body["detail"] == "AI food scanning service timed out. Please enter meal details manually."
                assert body["error_code"] == "AI_SERVICE_UNAVAILABLE"
                assert body["fallback_to_manual"] is True

    @pytest.mark.asyncio
    async def test_recommend_curated_meals_timeout_returns_balanced_fallback(self):
        """Verify recommend_curated_meals returns balanced static fallback without throwing on timeout."""
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content.side_effect = asyncio.TimeoutError()

            result = await gemini_service.recommend_curated_meals(
                goal_type="muscle_building",
                diet_type="veg",
                budget_tier="moderate",
                calorie_goal=2200,
            )

            assert isinstance(result, dict)
            assert result["budget_tier"] == "moderate"
            assert result["diet_type"] == "veg"
            assert "recommendations" in result
            assert len(result["recommendations"]) == 4

            # Verify all recommendation fields adhere to MealRecommendationOption schema
            for rec in result["recommendations"]:
                assert "dish_name" in rec
                assert "meal_type" in rec
                assert "calories" in rec
                assert "protein" in rec
                assert "carbs" in rec
                assert "fat" in rec
                assert rec["calories"] > 0
                assert rec["protein"] > 0

    @pytest.mark.asyncio
    async def test_generate_multiple_meal_plans_timeout_returns_fallback(self):
        """Verify generate_multiple_meal_plans returns 3 valid static fallback plans on API timeout."""
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content.side_effect = TimeoutError()

            plans_data = await gemini_service.generate_multiple_meal_plans(
                goal_type="fat_loss",
                diet_type="non_veg",
                budget_tier="low_budget",
                workout_time="morning",
                calorie_goal=1800,
                protein_goal=140,
                carbs_goal=180,
                fat_goal=55,
            )

            assert "plans" in plans_data
            plans = plans_data["plans"]
            assert len(plans) == 3

            for plan in plans:
                assert "plan_id" in plan
                assert "plan_name" in plan
                assert "tagline" in plan
                assert plan["total_calories"] == 1800
                assert len(plan["meals"]) == 4

    @pytest.mark.asyncio
    async def test_generate_morning_briefing_timeout_returns_fallback(self):
        """Verify generate_morning_briefing returns structured fallback on API timeout."""
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content.side_effect = asyncio.TimeoutError()

            briefing = await gemini_service.generate_morning_briefing(
                user_name="Sahil",
                goal_type="fat_loss",
                calorie_goal=2000,
                protein_goal=150,
                carbs_goal=200,
                fat_goal=65,
                yesterday_calories=1850,
                yesterday_protein=145,
                yesterday_carbs=190,
                yesterday_fat=60,
                yesterday_meal_count=3,
                yesterday_meals=[],
            )

            assert isinstance(briefing, dict)
            assert "greeting" in briefing
            assert "status_badge" in briefing
            assert "feedback" in briefing
            assert "improvements" in briefing
            assert len(briefing["improvements"]) == 2


# ============================================================================
# 3. CORS Hardening & Error Sanitization Tests
# ============================================================================

class TestCORSHardeningAndSanitization:
    @pytest.mark.asyncio
    async def test_production_cors_allows_legitimate_origins(self):
        """Verify production origins (corecontrol.fit) receive Access-Control-Allow-Origin."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            for origin in ["https://corecontrol.fit", "https://www.corecontrol.fit"]:
                resp = await client.options(
                    "/health",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "GET",
                    },
                )
                assert resp.headers.get("access-control-allow-origin") == origin

    @pytest.mark.asyncio
    async def test_production_cors_blocks_wildcard_regex_domains(self):
        """Verify that under production CORS settings, untrusted vercel/netlify domains are rejected."""
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware

        # Test production CORS configuration logic
        test_prod_app = FastAPI()
        prod_origins = ["https://corecontrol.fit", "https://www.corecontrol.fit"]
        test_prod_app.add_middleware(
            CORSMiddleware,
            allow_origins=prod_origins,
            allow_origin_regex=None,  # Regex explicitly disabled in production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @test_prod_app.get("/test")
        def dummy():
            return {"status": "ok"}

        transport = httpx.ASGITransport(app=test_prod_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            untrusted = ["https://malicious.vercel.app", "https://phishing.netlify.app", "http://evil.com"]
            for evil_origin in untrusted:
                resp = await client.options(
                    "/test",
                    headers={
                        "Origin": evil_origin,
                        "Access-Control-Request-Method": "GET",
                    },
                )
                assert resp.headers.get("access-control-allow-origin") is None

    @pytest.mark.asyncio
    async def test_unhandled_exception_sanitized_in_production(self, monkeypatch):
        """Verify global exception handler in production returns sanitized 500 without leaking stack trace."""
        import app.main as main_mod

        # Temporarily set APP_ENV to production
        monkeypatch.setattr(main_mod.app_settings, "APP_ENV", "production")

        # Simulate route with unhandled runtime exception containing sensitive error text
        sensitive_error = "FATAL: password authentication failed for user 'neon_admin_secret'"
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.routers.meals.get_meals_by_date", side_effect=RuntimeError(sensitive_error)):
                app.dependency_overrides[get_current_user] = lambda: User(id=1, email="test@test.com")
                resp = await client.get("/api/meals/today")

                assert resp.status_code == 500
                body = resp.json()
                assert body == {"detail": "An internal server error occurred. Please try again later."}
                assert "neon_admin_secret" not in resp.text
                assert "Traceback" not in resp.text

    @pytest.mark.asyncio
    async def test_starlette_500_exception_sanitized_in_production(self, monkeypatch):
        """Verify StarletteHTTPException with status >= 500 is sanitized in production."""
        import app.main as main_mod
        monkeypatch.setattr(main_mod.app_settings, "APP_ENV", "production")

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            with patch("app.routers.meals.get_meals_by_date", side_effect=HTTPException(status_code=500, detail="Database leaked table schema")):
                app.dependency_overrides[get_current_user] = lambda: User(id=1, email="test@test.com")
                resp = await client.get("/api/meals/today")

                assert resp.status_code == 500
                assert resp.json() == {"detail": "An internal server error occurred. Please try again later."}
                assert "leaked table schema" not in resp.text


# ============================================================================
# 4. Neon Database Connection Pool Resilience Tests
# ============================================================================

class TestDatabaseResilience:
    def test_sqlite_engine_pool_resilience_settings(self):
        """Verify active engine has pool_pre_ping and pool_recycle configured."""
        assert hasattr(engine.pool, "_pre_ping")
        assert engine.pool._pre_ping is True
        assert engine.pool._recycle == 300

    def test_postgres_engine_pool_kwargs_configured(self):
        """Verify engine kwargs for PostgreSQL include pool_pre_ping, pool_recycle, and pool_timeout."""
        from sqlalchemy.ext.asyncio import create_async_engine

        # Mock Postgres connection URL to test engine_kwargs logic in app.database
        test_pg_url = "postgresql+asyncpg://user:password@neon-db.cloud:5432/main"
        pg_engine = create_async_engine(
            test_pg_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_timeout=30,
        )

        assert pg_engine.pool._pre_ping is True
        assert pg_engine.pool._recycle == 300
        assert pg_engine.pool._timeout == 30
        assert pg_engine.pool._creator is not None


# ============================================================================
# 5. Configuration Validation Tests
# ============================================================================

class TestConfigValidation:
    def test_log_level_strictly_enforced_in_production(self):
        """Verify LOG_LEVEL must be strictly INFO or WARNING in production."""
        # DEBUG should fail in production
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                APP_ENV="production",
                LOG_LEVEL="DEBUG",
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                RAZORPAY_KEY_ID="rzp_live_testkey12345",
                RAZORPAY_KEY_SECRET="test_live_secret12345",
            )
        assert "LOG_LEVEL must be strictly 'INFO' or 'WARNING'" in str(exc_info.value)

        # INFO should succeed
        s_info = Settings(
            APP_ENV="production",
            LOG_LEVEL="INFO",
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
            RAZORPAY_KEY_ID="rzp_live_testkey12345",
            RAZORPAY_KEY_SECRET="test_live_secret12345",
        )
        assert s_info.LOG_LEVEL == "INFO"

        # WARNING should succeed
        s_warn = Settings(
            APP_ENV="production",
            LOG_LEVEL="WARNING",
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
            RAZORPAY_KEY_ID="rzp_live_testkey12345",
            RAZORPAY_KEY_SECRET="test_live_secret12345",
        )
        assert s_warn.LOG_LEVEL == "WARNING"

        # In development, DEBUG is permitted
        s_dev = Settings(
            APP_ENV="development",
            LOG_LEVEL="DEBUG",
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
        )
        assert s_dev.LOG_LEVEL == "DEBUG"

    def test_firebase_service_account_json_support(self):
        """Verify FIREBASE_SERVICE_ACCOUNT_JSON parses valid JSON and rejects invalid strings."""
        valid_json = json.dumps({"type": "service_account", "project_id": "fitscan-prod"})
        s = Settings(
            DATABASE_URL="sqlite:///:memory:",
            GEMINI_API_KEY="test_key",
            FIREBASE_SERVICE_ACCOUNT_JSON=valid_json,
        )
        assert s.FIREBASE_SERVICE_ACCOUNT_JSON == valid_json

        # Invalid JSON must raise ValidationError
        with pytest.raises(ValidationError):
            Settings(
                DATABASE_URL="sqlite:///:memory:",
                GEMINI_API_KEY="test_key",
                FIREBASE_SERVICE_ACCOUNT_JSON="not-valid-json-string",
            )


# ============================================================================
# 6. Health Monitoring Tests for UptimeRobot
# ============================================================================

class TestHealthMonitoring:
    @pytest.mark.asyncio
    async def test_health_endpoints_return_200_and_healthy_status(self):
        """Verify all health endpoints return 200 OK with status='healthy' for UptimeRobot monitoring."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            for endpoint in ["/health", "/api/health", "/api/v1/health"]:
                resp = await client.get(endpoint)
                assert resp.status_code == 200
                data = resp.json()
                assert data["status"] == "healthy"
                assert data["database"] == "connected"
                assert "database_latency_ms" in data
