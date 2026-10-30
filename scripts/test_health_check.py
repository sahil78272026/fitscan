#!/usr/bin/env python3
"""
Automated verification test runner for backend health check & latency monitoring endpoint.
Tests normal healthy status, simulated DB connection failures, timeouts, None-session handling,
HTTP method constraints, and strict Pydantic v2 schema invariant validation.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock

# Add backend directory to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
env_path = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

# Fallback test defaults if not loaded from .env
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("GEMINI_API_KEY", "test_dummy_gemini_key")

import httpx
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.main import app
from app.database import get_db
from app.schemas.health import HealthResponse


async def run_tests():
    print("=" * 60)
    print("🚀 Starting Health Check & Latency Monitoring Verification")
    print("=" * 60)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Test 1: Check healthy endpoints
        endpoints = ["/health", "/api/v1/health", "/api/health"]
        for ep in endpoints:
            print(f"\n[Test 1] Testing healthy GET {ep}...")
            res = await client.get(ep)
            print(f"  Status code: {res.status_code}")
            print(f"  Response JSON: {res.json()}")

            assert res.status_code == 200, f"Expected 200, got {res.status_code}"
            data = res.json()

            # Pydantic v2 strict schema validation
            validated = HealthResponse.model_validate(data)
            assert validated.status == "healthy", f"Expected healthy, got {validated.status}"
            assert validated.database == "connected", f"Expected connected, got {validated.database}"
            assert validated.database_latency_ms is not None, "Latency ms must not be None"
            assert isinstance(validated.database_latency_ms, (int, float)), "Latency ms must be numeric"
            assert validated.database_latency_ms >= 0, "Latency ms must be non-negative"
            assert isinstance(validated.timestamp, datetime), "Timestamp must be valid ISO 8601"
            print(f"  ✅ Schema validation passed for {ep}. Measured latency: {validated.database_latency_ms} ms")

        # Test 2: Check HEAD request
        print("\n[Test 2] Testing HEAD /api/v1/health...")
        head_res = await client.head("/api/v1/health")
        print(f"  Status code: {head_res.status_code}")
        assert head_res.status_code == 200, f"HEAD request failed with {head_res.status_code}"
        print("  ✅ HEAD request passed.")

        # Test 3: Test degraded status on simulated DB connection failure
        print("\n[Test 3] Testing degraded status on simulated DB connection failure...")
        mock_db = AsyncMock()
        mock_db.execute.side_effect = OperationalError(
            "SELECT 1", {}, Exception("Connection to PostgreSQL server at 'db:5432' failed: connection refused")
        )

        async def override_failing_db():
            yield mock_db

        app.dependency_overrides[get_db] = override_failing_db
        try:
            degraded_res = await client.get("/api/v1/health")
            print(f"  Status code: {degraded_res.status_code}")
            print(f"  Response JSON: {degraded_res.json()}")

            assert degraded_res.status_code == 200, f"Expected 200, got {degraded_res.status_code}"
            deg_data = degraded_res.json()

            validated_deg = HealthResponse.model_validate(deg_data)
            assert validated_deg.status == "degraded", f"Expected 'degraded', got {validated_deg.status}"
            assert validated_deg.database == "error", f"Expected 'error', got {validated_deg.database}"
            assert validated_deg.database_latency_ms is None, "Latency ms must be None on error"

            # Security check: Ensure no connection string or credential leaked in response
            for k, v in deg_data.items():
                if isinstance(v, str):
                    assert "password" not in v.lower(), f"Sensitive key found in {k}: {v}"
                    assert "5432" not in v, f"Host details leaked in {k}: {v}"
            print("  ✅ Degraded state handled correctly and no secrets leaked.")
        finally:
            app.dependency_overrides.pop(get_db, None)

        # Test 4: Test timeout handling
        print("\n[Test 4] Testing timeout degradation handling...")
        async def mock_timeout_execute(*args, **kwargs):
            await asyncio.sleep(6.0)

        mock_timeout_db = AsyncMock()
        mock_timeout_db.execute.side_effect = mock_timeout_execute

        async def override_timeout_db():
            yield mock_timeout_db

        app.dependency_overrides[get_db] = override_timeout_db
        try:
            timeout_res = await client.get("/health")
            print(f"  Status code: {timeout_res.status_code}")
            print(f"  Response JSON: {timeout_res.json()}")
            assert timeout_res.status_code == 200
            tout_data = timeout_res.json()
            assert tout_data["status"] == "degraded"
            assert tout_data["database"] == "error"
            print("  ✅ Timeout degradation handled properly.")
        finally:
            app.dependency_overrides.pop(get_db, None)

        # Test 5: Test session unavailable (db is None)
        print("\n[Test 5] Testing session unavailable handling...")
        async def override_none_db():
            yield None

        app.dependency_overrides[get_db] = override_none_db
        try:
            none_res = await client.get("/api/v1/health")
            print(f"  Status code: {none_res.status_code}")
            print(f"  Response JSON: {none_res.json()}")
            assert none_res.status_code == 200
            none_data = none_res.json()
            validated_none = HealthResponse.model_validate(none_data)
            assert validated_none.status == "degraded"
            assert validated_none.database == "error"
            assert validated_none.database_latency_ms is None
            print("  ✅ Session unavailable degradation handled properly.")
        finally:
            app.dependency_overrides.pop(get_db, None)

        # Test 6: Test trailing slashes
        print("\n[Test 6] Testing trailing slashes support...")
        for ep_slash in ["/health/", "/api/v1/health/", "/api/health/"]:
            slash_res = await client.get(ep_slash)
            assert slash_res.status_code == 200, f"Expected 200 on {ep_slash}, got {slash_res.status_code}"
            assert slash_res.json()["status"] == "healthy"
        print("  ✅ Trailing slashes handled cleanly without redirect.")

        # Test 7: Test dependency crash resilience
        print("\n[Test 7] Testing dependency crash resilience...")
        async def override_crashing_db():
            raise RuntimeError("Database connection pool completely crashed!")
            yield None

        app.dependency_overrides[get_db] = override_crashing_db
        try:
            crash_res = await client.get("/api/v1/health")
            print(f"  Status code: {crash_res.status_code}")
            print(f"  Response JSON: {crash_res.json()}")
            assert crash_res.status_code == 200, f"Expected 200, got {crash_res.status_code}"
            crash_data = crash_res.json()
            validated_crash = HealthResponse.model_validate(crash_data)
            assert validated_crash.status == "degraded"
            assert validated_crash.database == "error"
            assert validated_crash.database_latency_ms is None
            print("  ✅ Dependency crash safely handled and converted to degraded 200 response.")
        finally:
            app.dependency_overrides.pop(get_db, None)

        # Test 8: Test concurrency
        print("\n[Test 8] Testing concurrency handling (30 parallel requests)...")
        tasks = [client.get("/api/v1/health") for _ in range(30)]
        c_responses = await asyncio.gather(*tasks)
        assert len(c_responses) == 30
        assert all(r.status_code == 200 for r in c_responses)
        print("  ✅ All 30 parallel requests completed successfully.")

        # Test 9: Test HTTP method restrictions
        print("\n[Test 9] Testing HTTP method restrictions (405 Method Not Allowed)...")
        post_res = await client.post("/api/v1/health", json={"dummy": "value"})
        assert post_res.status_code == 405, f"Expected 405 on POST, got {post_res.status_code}"
        put_res = await client.put("/api/v1/health", json={"dummy": "value"})
        assert put_res.status_code == 405, f"Expected 405 on PUT, got {put_res.status_code}"
        print("  ✅ Method restrictions enforced.")

        # Test 10: Strict schema invariant validation
        print("\n[Test 10] Testing Pydantic v2 schema invariants...")
        try:
            HealthResponse(
                status="healthy",
                database="error",
                database_latency_ms=1.5,
                timestamp=datetime.now(timezone.utc),
            )
            assert False, "Should have raised ValidationError for healthy with database error"
        except ValidationError:
            pass

        try:
            HealthResponse(
                status="healthy",
                database="connected",
                database_latency_ms=-10.0,
                timestamp=datetime.now(timezone.utc),
            )
            assert False, "Should have raised ValidationError for negative latency"
        except ValidationError:
            pass

        try:
            HealthResponse(
                status="degraded",
                database="error",
                database_latency_ms=5.0,
                timestamp=datetime.now(timezone.utc),
            )
            assert False, "Should have raised ValidationError for error state with latency"
        except ValidationError:
            pass

        try:
            HealthResponse(
                status="healthy",
                database="connected",
                database_status="error",
                database_latency_ms=2.0,
                timestamp=datetime.now(timezone.utc),
            )
            assert False, "Should have raised ValidationError for mismatched database_status"
        except ValidationError:
            pass

        # Reject infinite latency
        try:
            HealthResponse(
                status="healthy",
                database="connected",
                database_latency_ms=float("inf"),
                timestamp=datetime.now(timezone.utc),
            )
            assert False, "Should have raised ValidationError for infinite latency"
        except ValidationError:
            pass

        # Validate auto-synchronization and input alias resolution
        auto_resp = HealthResponse(
            status="healthy",
            database="connected",
            database_latency_ms=2.5,
            timestamp=datetime.now(timezone.utc),
        )
        assert auto_resp.database_status == "connected"
        assert auto_resp.latency_ms == 2.5

        from_alias_dict = HealthResponse.model_validate({
            "status": "healthy",
            "database_status": "connected",
            "latency_ms": 1.25,
            "timestamp": datetime.now(timezone.utc),
        })
        assert from_alias_dict.database == "connected"
        assert from_alias_dict.database_latency_ms == 1.25
        print("  ✅ Schema invariants strictly enforced by Pydantic v2.")

        # Test 11: Teardown exception resilience
        print("\n[Test 11] Testing database generator teardown exception resilience...")
        async def override_failing_cleanup_db():
            mock = AsyncMock()
            mock.execute.return_value.scalar.return_value = 1
            yield mock
            raise RuntimeError("Database pool connection dropped on teardown cleanup")

        app.dependency_overrides[get_db] = override_failing_cleanup_db
        try:
            td_res = await client.get("/api/v1/health")
            assert td_res.status_code == 200, f"Expected 200, got {td_res.status_code}"
            assert td_res.json()["status"] == "healthy"
            print("  ✅ Teardown cleanup exception safely handled without crashing generator.")
        finally:
            app.dependency_overrides.pop(get_db, None)

        # Test 12: Callable returning coroutine & non-callable session overrides
        print("\n[Test 12] Testing callable returning coroutine and non-callable session overrides...")
        async def make_coro_session():
            mock = AsyncMock()
            mock.execute.return_value.scalar.return_value = 1
            return mock

        app.dependency_overrides[get_db] = lambda: make_coro_session()
        try:
            coro_res = await client.get("/api/v1/health")
            assert coro_res.status_code == 200
            assert coro_res.json()["status"] == "healthy"
        finally:
            app.dependency_overrides.pop(get_db, None)

        from unittest.mock import MagicMock
        class DirectSession:
            async def execute(self, stmt):
                m = MagicMock()
                m.scalar.return_value = 1
                return m
            async def rollback(self):
                pass

        app.dependency_overrides[get_db] = DirectSession()
        try:
            direct_res = await client.get("/api/v1/health")
            assert direct_res.status_code == 200
            assert direct_res.json()["status"] == "healthy"
            print("  ✅ Dynamic session override factories properly resolved.")
        finally:
            app.dependency_overrides.pop(get_db, None)


    print("\n" + "=" * 60)
    print("🎉 ALL HEALTH CHECK & LATENCY MONITORING TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_tests())

