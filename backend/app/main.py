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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev only). Use Alembic for production."""
    logger.info("🏋️ FitScan starting up...")
    if app_settings.APP_ENV == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created/verified")
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


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": "FitScan"}
