import os
import sys
import pytest
import httpx
from unittest.mock import AsyncMock

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.models.user import User
from app.models.meal import Meal
from app.models.weight import WeightLog
from app.models.step import StepLog
from app.middleware.auth import get_current_user
from app.database import get_db


@pytest.fixture
def mock_user():
    return User(id=99, email="safe_delete@example.com", name="Safe Delete User")


@pytest.mark.asyncio
async def test_reset_data_requires_exact_confirmation(mock_user):
    """Confirm that POST /api/settings/reset-data rejects invalid confirmation strings."""
    app.dependency_overrides[get_current_user] = lambda: mock_user

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Lowercase "reset" must be rejected
        res = await client.post("/api/settings/reset-data", json={"scope": "all_logs", "confirmation": "reset"})
        assert res.status_code == 422

        # Wrong keyword must be rejected
        res = await client.post("/api/settings/reset-data", json={"scope": "all_logs", "confirmation": "DELETE"})
        assert res.status_code == 422

        # Invalid scope must be rejected
        res = await client.post("/api/settings/reset-data", json={"scope": "invalid_scope", "confirmation": "RESET"})
        assert res.status_code == 422

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_reset_data_success_flow(mock_user):
    """Confirm that POST /api/settings/reset-data succeeds with 'RESET' confirmation."""
    mock_db = AsyncMock()
    mock_execute_res = AsyncMock()
    mock_execute_res.rowcount = 5
    mock_db.execute.return_value = mock_execute_res
    mock_db.commit = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/settings/reset-data",
            json={"scope": "meals", "confirmation": "RESET"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["scope"] == "meals"
        assert data["records_cleared"] == 5
        assert "Successfully reset" in data["message"]
        mock_db.commit.assert_awaited_once()

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_delete_account_with_reauth_header(mock_user):
    """Confirm that DELETE /api/auth/me accepts X-Reauth-Token header and deletes account."""
    mock_db = AsyncMock()
    mock_db.delete = AsyncMock()
    mock_db.commit = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.delete(
            "/api/auth/me",
            headers={"X-Reauth-Token": "verified-test-credential-token"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "permanently deleted" in data["message"].lower()
        mock_db.delete.assert_awaited_once_with(mock_user)
        mock_db.commit.assert_awaited_once()

    app.dependency_overrides.clear()
