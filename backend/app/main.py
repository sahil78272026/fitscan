import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.database import engine, Base, AsyncSessionLocal


def get_rate_limit_key(request: Request) -> str:
    """
    Key by authenticated user ID if present (from JWT Authorization header),
    fallback to client remote IP address.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            from app.services.auth_service import decode_jwt_token
            payload = decode_jwt_token(token)
            if payload and "sub" in payload:
                return f"user:{payload['sub']}"
        except Exception:
            pass
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


limiter = Limiter(key_func=get_rate_limit_key)

from app.routers import auth, meals, daily_summary, settings, calendar, stats, weight, steps, health, subscription, coupons, payments

# Import models so they're registered with Base.metadata
from app.models import User, Meal, FoodItem, UserSettings, WeightLog, StepLog, PaymentOrder, Coupon, CouponRedemption  # noqa: F401

app_settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, app_settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("corecontrol")


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
        ("user_settings", "start_weight_kg", "FLOAT"),
        ("user_settings", "activity_level", "VARCHAR(50) DEFAULT 'moderate'"),
        ("user_settings", "workout_time", "VARCHAR(50) DEFAULT 'evening'"),
        ("user_settings", "selected_meal_plan", "TEXT"),
        ("user_settings", "subscription_tier", "VARCHAR(20) DEFAULT 'free'"),
        ("user_settings", "subscription_status", "VARCHAR(30) DEFAULT 'trial_active'"),
        ("user_settings", "subscription_expires_at", "TIMESTAMP WITH TIME ZONE"),
        ("user_settings", "last_plan_change_at", "TIMESTAMP WITH TIME ZONE"),
        ("user_settings", "morning_briefing_enabled", "INTEGER DEFAULT 1"),
        ("user_settings", "morning_briefing_start_hour", "INTEGER DEFAULT 6"),
        ("user_settings", "morning_briefing_end_hour", "INTEGER DEFAULT 11"),
        ("user_settings", "morning_briefing_frequency", "VARCHAR(20) DEFAULT 'daily'"),
        ("user_settings", "morning_briefing_cache", "TEXT"),
        ("meals", "total_protein", "FLOAT DEFAULT 0.0"),
        ("meals", "total_carbs", "FLOAT DEFAULT 0.0"),
        ("meals", "total_fat", "FLOAT DEFAULT 0.0"),
        ("meals", "image_url", "VARCHAR(500)"),
        ("food_items", "protein", "FLOAT DEFAULT 0.0"),
        ("food_items", "carbs", "FLOAT DEFAULT 0.0"),
        ("food_items", "fat", "FLOAT DEFAULT 0.0"),
        ("users", "email", "VARCHAR(255)"),
        ("users", "avatar_url", "VARCHAR(500)"),
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

    if is_pg:
        try:
            await conn.execute(text("ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;"))
        except Exception as e:
            logger.debug(f"users phone drop not null note: {e}")
        try:
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);"))
        except Exception as e:
            logger.debug(f"users email index note: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables & migrate schema on startup."""
    logger.info("🏋️ CoreControl starting up...")
    async with engine.begin() as conn:
        await init_db_schema(conn)
    logger.info("✅ Database tables & macro schema verified")

    try:
        from sqlalchemy import select, func
        async with AsyncSessionLocal() as session:
            for code in ("TESTFREE", "ADV_LAUNCH100"):
                stmt = select(Coupon).where(func.upper(Coupon.code) == code)
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if not existing:
                    coupon = Coupon(
                        code=code,
                        discount_percentage=100,
                        duration_days=365,
                        max_uses=None,
                        times_used=0,
                        is_active=True,
                    )
                    session.add(coupon)
            await session.commit()
            logger.info("🎟️ Default access coupons verified (TESTFREE, ADV_LAUNCH100)")
    except Exception as e:
        logger.warning(f"Could not auto-seed default coupons: {e}")

    yield
    logger.info("👋 CoreControl shutting down...")
    await engine.dispose()



app = FastAPI(
    title="CoreControl API",
    description="Calorie tracking powered by Gemini AI",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS Hardening: Strict in production, permissive for local/LAN dev
is_production = app_settings.APP_ENV == "production"

if is_production:
    prod_origins = ["https://corecontrol.fit", "https://www.corecontrol.fit"]
    for origin in [o.strip() for o in app_settings.FRONTEND_ORIGIN.split(",") if o.strip()]:
        if (origin.startswith("http://") or origin.startswith("https://")) and origin not in prod_origins:
            prod_origins.append(origin)
    cors_origins = prod_origins
    allow_origin_regex = None
else:
    dev_origins = [o.strip() for o in app_settings.FRONTEND_ORIGIN.split(",") if o.strip()]
    for origin in [
        "https://corecontrol.fit",
        "https://www.corecontrol.fit",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8081",
    ]:
        if origin not in dev_origins:
            dev_origins.append(origin)
    cors_origins = dev_origins
    allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.0\.2\.2)(:\d+)?"

cors_kwargs = {
    "allow_origins": cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if allow_origin_regex:
    cors_kwargs["allow_origin_regex"] = allow_origin_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)


# Global Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code >= 500:
        logger.error(f"HTTP {exc.status_code} at {request.url.path}: {exc.detail}")
        if app_settings.APP_ENV == "production":
            return JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred. Please try again later."},
            )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {exc}", exc_info=True)
    if app_settings.APP_ENV == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred. Please try again later."},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

# Register routers
app.include_router(auth.router)
app.include_router(meals.router)
app.include_router(daily_summary.router)
app.include_router(settings.router)
app.include_router(calendar.router)
app.include_router(stats.router)
app.include_router(weight.router)
app.include_router(steps.router)
app.include_router(health.router)
app.include_router(subscription.router)
app.include_router(coupons.router)
app.include_router(payments.router)

