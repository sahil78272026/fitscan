#!/usr/bin/env python3
"""
FitScan Database Schema Comparison Tool
======================================
Usage:
  1. Compare ORM Models vs Local DB:
     python scripts/compare_schema.py

  2. Compare ORM Models vs Remote DB:
     python scripts/compare_schema.py --db-url "postgresql://user:pass@host/db"

  3. Compare Two Databases (Local DB vs Production DB):
     python scripts/compare_schema.py --source-url "sqlite:///backend/fitscan.db" --target-url "postgresql://user:pass@host/db"
"""

import sys
import os
import argparse
from pathlib import Path

# Add backend directory to python path so 'app' module can be imported
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Change working directory to backend so .env is loaded correctly
os.chdir(BACKEND_DIR)

from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

# Load backend/.env
load_dotenv(BACKEND_DIR / ".env")

# Import all SQLAlchemy models to register them on Base.metadata
try:
    from app.database import Base, settings
    from app.models import User, Meal, FoodItem, UserSettings, WeightLog, StepLog  # noqa: F401
except Exception as e:
    print(f"⚠️ Error importing models/database config: {e}")
    sys.exit(1)


import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

def format_db_url_for_async(url: str) -> str:
    """Ensure DB URL uses async driver (asyncpg for postgres, aiosqlite for sqlite)."""
    if not url:
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("sqlite:///") and not "aiosqlite" in url:
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    return url


async def inspect_db_async(db_url: str):
    """Reflect database schema using async engine & run_sync inspector."""
    async_url = format_db_url_for_async(db_url)
    engine_kwargs = {}
    if "sqlite" in async_url:
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_async_engine(async_url, **engine_kwargs)

    def _sync_inspect(conn):
        inspector = inspect(conn)
        tables = {}
        for table in inspector.get_table_names():
            columns = {}
            for col in inspector.get_columns(table):
                columns[col["name"]] = {
                    "type": str(col["type"]).upper(),
                    "nullable": col.get("nullable", True),
                    "default": str(col.get("default", "")) if col.get("default") else None,
                }
            tables[table] = columns
        return tables

    async with engine.connect() as conn:
        tables = await conn.run_sync(_sync_inspect)

    await engine.dispose()
    return tables


def inspect_db(db_url: str):
    """Synchronous wrapper around inspect_db_async."""
    return asyncio.run(inspect_db_async(db_url))


def inspect_orm_models():
    """Extract expected schema from SQLAlchemy ORM metadata."""
    tables = {}
    for table_name, table in Base.metadata.tables.items():
        columns = {}
        for col in table.columns:
            columns[col.name] = {
                "type": str(col.type).upper(),
                "nullable": col.nullable,
                "default": str(col.default) if col.default else None,
            }
        tables[table_name] = columns
    return tables


TYPE_ALIASES = {
    "FLOAT": {"FLOAT", "DOUBLE PRECISION", "REAL", "NUMERIC"},
    "DATETIME": {"DATETIME", "TIMESTAMP", "TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP WITH TIME ZONE"},
    "INTEGER": {"INTEGER", "INT", "BIGINT", "SMALLINT"},
    "VARCHAR": {"VARCHAR", "TEXT", "STRING"},
}

def are_types_compatible(type1: str, type2: str) -> bool:
    t1, t2 = type1.upper(), type2.upper()
    if t1 == t2 or t1 in t2 or t2 in t1:
        return True
    for base, aliases in TYPE_ALIASES.items():
        if any(a in t1 for a in aliases) and any(a in t2 for a in aliases):
            return True
    return False


def compare_schemas(source_name: str, source_schema: dict, target_name: str, target_schema: dict):
    """Compare source schema vs target schema and print detailed diff."""
    print("=" * 70)
    print(f"🔍 SCHEMA COMPARISON REPORT: [{source_name}] vs [{target_name}]")
    print("=" * 70)

    mismatch_count = 0
    missing_table_count = 0
    missing_col_count = 0

    all_tables = sorted(set(source_schema.keys()) | set(target_schema.keys()))

    for table in all_tables:
        if table not in source_schema:
            print(f"\n➕ Table '{table}' exists in [{target_name}] but NOT in [{source_name}]")
            continue

        if table not in target_schema:
            print(f"\n❌ Table '{table}' missing in [{target_name}] (Present in {source_name})")
            missing_table_count += 1
            continue

        print(f"\n📋 Table: {table}")
        source_cols = source_schema[table]
        target_cols = target_schema[table]
        all_cols = sorted(set(source_cols.keys()) | set(target_cols.keys()))

        table_has_diff = False

        for col in all_cols:
            if col not in target_cols:
                print(f"   ❌ Missing Column: '{col}' (expected in {target_name})")
                missing_col_count += 1
                table_has_diff = True
            elif col not in source_cols:
                print(f"   ➕ Extra Column in {target_name}: '{col}'")
                table_has_diff = True
            else:
                s_type = source_cols[col]["type"]
                t_type = target_cols[col]["type"]
                s_null = source_cols[col]["nullable"]
                t_null = target_cols[col]["nullable"]

                type_match = are_types_compatible(s_type, t_type)
                null_match = (s_null == t_null)

                if not type_match or not null_match:
                    diff_parts = []
                    if not type_match:
                        diff_parts.append(f"Type: {source_name} ({s_type}) vs {target_name} ({t_type})")
                    if not null_match:
                        diff_parts.append(f"Nullable: {source_name} ({s_null}) vs {target_name} ({t_null})")
                    print(f"   ⚠️ Mismatch on '{col}': {', '.join(diff_parts)}")
                    mismatch_count += 1
                    table_has_diff = True

        if not table_has_diff:
            print(f"   ✅ All {len(source_cols)} columns match perfectly!")

    print("\n" + "=" * 70)
    print("📊 SUMMARY:")
    print(f"   - Missing Tables:  {missing_table_count}")
    print(f"   - Missing Columns: {missing_col_count}")
    print(f"   - Property Mismatches: {mismatch_count}")
    print("=" * 70)

    if missing_table_count == 0 and missing_col_count == 0 and mismatch_count == 0:
        print("🎉 SUCCESS: Schemas are perfectly aligned!")
    else:
        print("⚠️ NOTICE: Differences found between schemas.")


def main():
    parser = argparse.ArgumentParser(description="Compare database schema with ORM code or another database.")
    parser.add_argument("--db-url", help="Database URL to compare against ORM models (default: DATABASE_URL from .env)")
    parser.add_argument("--source-url", help="Source DB URL (if comparing two databases directly)")
    parser.add_argument("--target-url", help="Target DB URL (if comparing two databases directly)")

    args = parser.parse_args()

    if args.source_url and args.target_url:
        print(f"🔄 Inspecting Source Database: {args.source_url}")
        source_schema = inspect_db(args.source_url)
        print(f"🔄 Inspecting Target Database: {args.target_url}")
        target_schema = inspect_db(args.target_url)
        compare_schemas("Source DB", source_schema, "Target DB", target_schema)
    else:
        target_db_url = args.db_url or getattr(settings, "DATABASE_URL", None) or os.getenv("DATABASE_URL")
        if not target_db_url:
            print("❌ Error: No DATABASE_URL found. Please set DATABASE_URL in backend/.env or pass --db-url.")
            sys.exit(1)

        print("🔍 Inspecting SQLAlchemy ORM Models (Code)...")
        orm_schema = inspect_orm_models()
        print(f"🔍 Inspecting Database at: {format_db_url_for_async(target_db_url)}...")
        db_schema = inspect_db(target_db_url)

        compare_schemas("ORM Models (Code)", orm_schema, "Actual Database", db_schema)


if __name__ == "__main__":
    main()
