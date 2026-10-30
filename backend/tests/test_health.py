import asyncio
import os
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock
import pytest
import httpx
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("GEMINI_API_KEY", "test_dummy_gemini_key")

from app.main import app
from app.database import get_db
from app.schemas.health import HealthResponse


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_health_check_success():
    """Verify health endpoint returns 200 OK with valid JSON matching HealthResponse when DB is available."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        for path in ["/health", "/api/v1/health", "/api/health"]:
            response = await client.get(path)
            assert response.status_code == 200, f"Failed on path {path}: {response.text}"
            data = response.json()

            # Schema validation
            validated = HealthResponse.model_validate(data)
            assert validated.status == "healthy"
            assert validated.database == "connected"
            assert validated.database_latency_ms is not None
            assert isinstance(validated.database_latency_ms, (int, float))
            assert validated.database_latency_ms >= 0
            assert isinstance(validated.timestamp, datetime)

            # Contractual fields
            assert data["status"] == "healthy"
            assert data["database"] == "connected"
            assert isinstance(data["database_latency_ms"], (int, float))
            assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_check_head_request():
    """Verify HEAD requests are supported for lightweight health probes."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.head("/api/v1/health")
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_check_database_failure():
    """Verify degraded status and proper error handling when database query fails."""
    mock_db = AsyncMock()
    mock_db.execute.side_effect = OperationalError("SELECT 1", {}, Exception("Database connection refused"))

    async def override_failing_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_failing_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            data = response.json()

            # Schema validation
            validated = HealthResponse.model_validate(data)
            assert validated.status == "degraded"
            assert validated.database == "error"
            assert validated.database_latency_ms is None
            assert isinstance(validated.timestamp, datetime)

            # Contractual fields
            assert data["status"] == "degraded"
            assert data["database"] == "error"
            assert data["database_latency_ms"] is None

            # Verify no sensitive information or connection strings in payload
            for key, val in data.items():
                if isinstance(val, str):
                    assert "password" not in val.lower()
                    assert "postgres" not in val.lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check_timeout_handling():
    """Verify degraded status when database ping exceeds timeout."""
    async def slow_execute(*args, **kwargs):
        await asyncio.sleep(6.0)

    mock_db = AsyncMock()
    mock_db.execute.side_effect = slow_execute

    async def override_slow_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_slow_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/health")
            assert response.status_code == 200
            data = response.json()

            validated = HealthResponse.model_validate(data)
            assert validated.status == "degraded"
            assert validated.database == "error"
            assert validated.database_latency_ms is None
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check_session_unavailable():
    """Verify degraded status when database session cannot be obtained (db is None)."""
    async def override_none_db():
        yield None

    app.dependency_overrides[get_db] = override_none_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            data = response.json()

            validated = HealthResponse.model_validate(data)
            assert validated.status == "degraded"
            assert validated.database == "error"
            assert validated.database_latency_ms is None
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check_unsupported_methods():
    """Verify endpoint rejects unsupported HTTP methods with 405 Method Not Allowed."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        post_res = await client.post("/api/v1/health", json={"test": "data"})
        assert post_res.status_code == 405
        put_res = await client.put("/api/v1/health", json={"test": "data"})
        assert put_res.status_code == 405
        delete_res = await client.delete("/api/v1/health")
        assert delete_res.status_code == 405


@pytest.mark.asyncio
async def test_health_check_dependency_exception():
    """Verify endpoint returns degraded 200 OK when dependency injection raises an unhandled exception."""
    async def override_crashing_db():
        raise RuntimeError("Database connection pool exhausted or driver crash")
        yield None

    app.dependency_overrides[get_db] = override_crashing_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            data = response.json()

            validated = HealthResponse.model_validate(data)
            assert validated.status == "degraded"
            assert validated.database == "error"
            assert validated.database_latency_ms is None
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check_trailing_slashes():
    """Verify endpoint supports trailing slashes without redirect."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        for path in ["/health/", "/api/v1/health/", "/api/health/"]:
            response = await client.get(path)
            assert response.status_code == 200, f"Failed on path {path}: {response.text}"
            data = response.json()
            assert data["status"] == "healthy"
            assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_health_check_concurrency():
    """Verify endpoint handles concurrent probes reliably without race conditions."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        tasks = [client.get("/api/v1/health") for _ in range(25)]
        responses = await asyncio.gather(*tasks)
        assert len(responses) == 25
        for res in responses:
            assert res.status_code == 200
            data = res.json()
            validated = HealthResponse.model_validate(data)
            assert validated.status == "healthy"
            assert validated.database == "connected"
            assert validated.database_latency_ms is not None


def test_health_response_schema_invariants():
    """Verify strict Pydantic v2 schema enforces health invariants."""
    # Valid healthy response
    valid_healthy = HealthResponse(
        status="healthy",
        database="connected",
        database_latency_ms=1.45,
        timestamp=datetime.now(timezone.utc),
    )
    assert valid_healthy.status == "healthy"
    assert valid_healthy.database_latency_ms == 1.45

    # Valid degraded response
    valid_degraded = HealthResponse(
        status="degraded",
        database="error",
        database_latency_ms=None,
        timestamp=datetime.now(timezone.utc),
    )
    assert valid_degraded.status == "degraded"
    assert valid_degraded.database_latency_ms is None

    # Invalid: healthy with database error
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            database="error",
            database_latency_ms=1.45,
            timestamp=datetime.now(timezone.utc),
        )

    # Invalid: healthy with None latency
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            database="connected",
            database_latency_ms=None,
            timestamp=datetime.now(timezone.utc),
        )

    # Invalid: negative latency
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            database="connected",
            database_latency_ms=-2.0,
            timestamp=datetime.now(timezone.utc),
        )

    # Invalid: database error with non-None latency
    with pytest.raises(ValidationError):
        HealthResponse(
            status="degraded",
            database="error",
            database_latency_ms=5.0,
            timestamp=datetime.now(timezone.utc),
        )

    # Invalid: mismatched database_status alias
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            database="connected",
            database_status="error",
            database_latency_ms=2.0,
            timestamp=datetime.now(timezone.utc),
        )

    # Invalid: mismatched latency_ms alias
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            database="connected",
            database_latency_ms=2.0,
            latency_ms=5.0,
            timestamp=datetime.now(timezone.utc),
        )

    # Invalid: infinite latency
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            database="connected",
            database_latency_ms=float("inf"),
            timestamp=datetime.now(timezone.utc),
        )

    # Valid: auto-populated aliases from canonical fields
    auto_alias = HealthResponse(
        status="healthy",
        database="connected",
        database_latency_ms=3.14,
        timestamp=datetime.now(timezone.utc),
    )
    assert auto_alias.database_status == "connected"
    assert auto_alias.latency_ms == 3.14

    # Valid: auto-populated canonical fields from alias input dict
    from_dict = HealthResponse.model_validate({
        "status": "healthy",
        "database_status": "connected",
        "latency_ms": 2.71,
        "timestamp": datetime.now(timezone.utc),
    })
    assert from_dict.database == "connected"
    assert from_dict.database_latency_ms == 2.71


@pytest.mark.asyncio
async def test_health_check_teardown_exception_resilience():
    """Verify endpoint does not crash with 'generator didn't stop' when DB cleanup raises."""
    async def override_failing_cleanup_db():
        mock = AsyncMock()
        mock.execute.return_value.scalar.return_value = 1
        yield mock
        raise RuntimeError("Network socket reset during pool return on teardown")

    app.dependency_overrides[get_db] = override_failing_cleanup_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["database"] == "connected"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check_callable_coroutine_override():
    """Verify endpoint correctly awaits callables returning coroutines without unawaited coroutine warnings."""
    async def create_mock_session():
        mock = AsyncMock()
        mock.execute.return_value.scalar.return_value = 1
        return mock

    app.dependency_overrides[get_db] = lambda: create_mock_session()
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["database"] == "connected"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_check_non_callable_session_override():
    """Verify endpoint accepts non-callable session instances passed directly in dependency_overrides."""
    from unittest.mock import MagicMock

    class NonCallableSession:
        async def execute(self, stmt):
            m = MagicMock()
            m.scalar.return_value = 1
            return m

        async def rollback(self):
            pass

    session_instance = NonCallableSession()
    app.dependency_overrides[get_db] = session_instance
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["database"] == "connected"
    finally:
        app.dependency_overrides.pop(get_db, None)



