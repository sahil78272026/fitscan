import asyncio
import sys
import os
import time
from datetime import date, timedelta

# Add backend to Python path and set working directory so .env is loaded
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(backend_dir)
sys.path.insert(0, backend_dir)

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.meal import Meal
from sqlalchemy import select
from app.services.meal_service import get_daily_summary
from app.services.redis_service import cache_delete, cache_get, close_redis_client


async def run_benchmark():
    async with AsyncSessionLocal() as db:
        # 1. Find a user with meals to benchmark
        result = await db.execute(select(Meal.user_id).limit(1))
        user_id = result.scalar_one_or_none() or 1

        print(f"==================================================")
        print(f"🚀 FITSCAN MEAL LOG CACHE BENCHMARK (User #{user_id})")
        print(f"==================================================")

        test_date = date.today() - timedelta(days=1)
        cache_key = f"user:{user_id}:daily_summary:{test_date.isoformat()}"

        # Ensure cache is cold for run 1
        await cache_delete(cache_key)

        # Run 1: Cold Cache (Cache Miss -> DB Query + Cache Set)
        t0 = time.perf_counter()
        res_cold = await get_daily_summary(db, user_id, test_date)
        t_cold = (time.perf_counter() - t0) * 1000

        print(f"1. COLD CACHE (MISS -> DB Query + Redis Set): {t_cold:.1f} ms")
        print(f"   Summary: {res_cold.get('total_calories')} kcal | {res_cold.get('meal_count')} meals")

        # Run 2: Hot Cache (Cache Hit from Upstash Redis)
        t0 = time.perf_counter()
        res_hot_1 = await get_daily_summary(db, user_id, test_date)
        t_hot_1 = (time.perf_counter() - t0) * 1000

        print(f"2. HOT CACHE HIT #1 (Upstash Redis):        {t_hot_1:.1f} ms")

        # Run 3-5: Additional Hot Cache Hits for average latency
        hot_times = []
        for i in range(2, 6):
            t0 = time.perf_counter()
            res_hot = await get_daily_summary(db, user_id, test_date)
            t_ms = (time.perf_counter() - t0) * 1000
            hot_times.append(t_ms)
            print(f"   HOT CACHE HIT #{i} (Upstash Redis):        {t_ms:.1f} ms")

        avg_hot = sum([t_hot_1] + hot_times) / (len(hot_times) + 1)
        speedup = t_cold / avg_hot if avg_hot > 0 else 1.0

        print(f"--------------------------------------------------")
        print(f"📊 SUMMARY RESULTS:")
        print(f"   • Database (PostgreSQL via network):  {t_cold:.1f} ms")
        print(f"   • Upstash Redis Cache (Average):      {avg_hot:.1f} ms")
        print(f"   • Latency Reduction:                  {(t_cold - avg_hot):.1f} ms ({((t_cold - avg_hot)/t_cold)*100:.1f}% faster)")
        print(f"   • Speedup Factor:                     {speedup:.1f}x")
        print(f"==================================================")

        # Cleanup
        await close_redis_client()


if __name__ == "__main__":
    asyncio.run(run_benchmark())
