import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, meals, daily_summary, settings, calendar

# Import models so they're registered with Base.metadata
from app.models import User, Meal, FoodItem, UserSettings  # noqa: F401

app_settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, app_settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("fitscan")


from sqlalchemy import text

async def init_db_schema(conn):
    """Ensure database tables and all new macro & goal columns exist across SQLite and PostgreSQL."""
    await conn.run_sync(Base.metadata.create_all)

    columns_to_add = [
        # (table_name, column_name, column_type_and_default)
        ("user_settings", "protein_goal", "INTEGER DEFAULT 150"),
        ("user_settings", "carbs_goal", "INTEGER DEFAULT 200"),
        ("user_settings", "fat_goal", "INTEGER DEFAULT 65"),
        ("user_settings", "goal_type", "VARCHAR(50) DEFAULT 'fat_loss'"),
        ("user_settings", "diet_type", "VARCHAR(50) DEFAULT 'veg'"),
        ("user_settings", "budget_tier", "VARCHAR(50) DEFAULT 'moderate'"),
        ("user_settings", "age", "INTEGER"),
        ("user_settings", "gender", "VARCHAR(20)"),
        ("user_settings", "height_cm", "FLOAT"),
        ("user_settings", "weight_kg", "FLOAT"),
        ("user_settings", "activity_level", "VARCHAR(50) DEFAULT 'moderate'"),
        ("user_settings", "selected_meal_plan", "TEXT"),
        ("meals", "total_protein", "FLOAT DEFAULT 0.0"),
        ("meals", "total_carbs", "FLOAT DEFAULT 0.0"),
        ("meals", "total_fat", "FLOAT DEFAULT 0.0"),
        ("meals", "image_url", "VARCHAR(500)"),
        ("food_items", "protein", "FLOAT DEFAULT 0.0"),
        ("food_items", "carbs", "FLOAT DEFAULT 0.0"),
        ("food_items", "fat", "FLOAT DEFAULT 0.0"),
    ]

    is_pg = "postgresql" in str(conn.engine.url)

    for table, col, col_def in columns_to_add:
        if is_pg:
            stmt = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_def};"
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                logger.debug(f"Column {table}.{col} creation note: {e}")
        else:
            stmt = f"ALTER TABLE {table} ADD COLUMN {col} {col_def};"
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables & migrate schema on startup."""
    logger.info("🏋️ FitScan starting up...")
    async with engine.begin() as conn:
        await init_db_schema(conn)
    logger.info("✅ Database tables & macro schema verified")
    yield
    logger.info("👋 FitScan shutting down...")
    await engine.dispose()



app = FastAPI(
    title="FitScan API",
    description="Calorie tracking powered by Gemini AI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — support comma-separated origins + Netlify/Vercel preview patterns
cors_origins = [o.strip() for o in app_settings.FRONTEND_ORIGIN.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.vercel\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(meals.router)
app.include_router(daily_summary.router)
app.include_router(settings.router)
app.include_router(calendar.router)


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "healthy", "app": "FitScan"}
