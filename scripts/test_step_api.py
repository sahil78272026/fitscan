import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/.env")))

import httpx
from app.main import app

async def test_step_api():
    print("Testing Step Tracking API Endpoints in-process...")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Dev login
        login_res = await client.post("/api/auth/verify-otp", json={"phone": "+918285748373", "otp": "123456"})
        if login_res.status_code != 200:
            print(f"❌ Login failed: {login_res.text}")
            return

        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Logged in successfully, token retrieved.")

        # 2. Log steps (e.g. 7450 steps)
        log_res = await client.post("/api/steps", json={"step_count": 7450}, headers=headers)
        print(f"POST /api/steps ({log_res.status_code}): {log_res.json()}")
        assert log_res.status_code == 200
        assert log_res.json()["step_count"] == 7450
        assert log_res.json()["calories_burned"] == 298.0  # 7450 * 0.04

        # 3. Get daily steps
        daily_res = await client.get("/api/steps/daily", headers=headers)
        print(f"GET /api/steps/daily ({daily_res.status_code}): {daily_res.json()}")
        assert daily_res.status_code == 200
        assert daily_res.json()["step_count"] == 7450

        # 4. Get step history
        history_res = await client.get("/api/steps/history?days=7", headers=headers)
        print(f"GET /api/steps/history ({history_res.status_code}): {history_res.json()}")
        assert history_res.status_code == 200
        assert len(history_res.json()["logs"]) >= 1

        print("\n🎉 ALL STEP API ENDPOINTS PASSED EMPIRICAL VERIFICATION!")

if __name__ == "__main__":
    asyncio.run(test_step_api())
