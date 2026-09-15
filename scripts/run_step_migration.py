import asyncio
import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/.env")))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.database import Base
from app.models import StepLog  # noqa: F401

TEST_DB_URL = "postgresql+asyncpg://postgres.mttsptdsezzuorttvnzf:ESslnjTMQGfa9Uo3@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
PROD_DB_URL = "postgresql+asyncpg://postgres.ripdevffxhnwozqxgqhf:IdXBoL9QWCMt7fhB@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

async def migrate_db(db_url, db_label):
    print(f"\n--- Migrating {db_label} ---")
    engine = create_async_engine(db_url, pool_size=3, max_overflow=5)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name='step_logs';"))
        row = res.fetchone()
        if row:
            print(f"✅ 'step_logs' table exists in {db_label}")
    await engine.dispose()

async def main():
    await migrate_db(TEST_DB_URL, "TEST DATABASE")
    await migrate_db(PROD_DB_URL, "PROD DATABASE")
    print("\n🎉 Step logs table migration completed for both DBs!")

if __name__ == "__main__":
    asyncio.run(main())
