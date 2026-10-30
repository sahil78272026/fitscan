import asyncio
import inspect
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.health import HealthResponse

logger = logging.getLogger("corecontrol.routers.health")

router = APIRouter(tags=["Health"])


async def get_health_db(request: Request) -> AsyncGenerator[Optional[AsyncSession], None]:
    """
    Safely acquire a database session for health monitoring.
    Respects FastAPI dependency overrides for get_db and get_health_db,
    guarantees single-yield execution to prevent 'generator didn't stop' runtime crashes,
    and catches any engine, connection pool, or dependency resolution exceptions
    so the health check endpoint returns a graceful degraded response.
    """
    db_factory = request.app.dependency_overrides.get(get_db, get_db)
    session: Optional[AsyncSession] = None
    yielded = False
    try:
        if inspect.isasyncgenfunction(db_factory):
            agen = db_factory()
            try:
                session = await anext(agen)
                yielded = True
                yield session
            finally:
                try:
                    await anext(agen)
                except (StopAsyncIteration, GeneratorExit):
                    pass
                except Exception as cleanup_exc:
                    logger.warning(f"Database session async cleanup warning: {cleanup_exc}")
                finally:
                    try:
                        await agen.aclose()
                    except Exception:
                        pass
        elif inspect.isgeneratorfunction(db_factory):
            gen = db_factory()
            try:
                session = next(gen)
                yielded = True
                yield session
            finally:
                try:
                    next(gen)
                except (StopIteration, GeneratorExit):
                    pass
                except Exception as cleanup_exc:
                    logger.warning(f"Database session sync cleanup warning: {cleanup_exc}")
                finally:
                    try:
                        gen.close()
                    except Exception:
                        pass
        elif inspect.iscoroutinefunction(db_factory):
            session = await db_factory()
            yielded = True
            yield session
        elif callable(db_factory):
            session = db_factory()
            if inspect.isawaitable(session):
                session = await session
            yielded = True
            yield session
        elif hasattr(db_factory, "execute"):
            session = db_factory
            yielded = True
            yield session
        else:
            yielded = True
            yield None
    except Exception as exc:
        if not yielded:
            logger.warning(f"Failed to acquire database session for health check: {exc}")
            yield None
        else:
            logger.warning(f"Error during health check database teardown: {exc}")


@router.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
@router.api_route("/health/", methods=["GET", "HEAD"], response_model=HealthResponse, include_in_schema=False)
@router.api_route("/api/v1/health", methods=["GET", "HEAD"], response_model=HealthResponse)
@router.api_route("/api/v1/health/", methods=["GET", "HEAD"], response_model=HealthResponse, include_in_schema=False)
@router.api_route("/api/health", methods=["GET", "HEAD"], response_model=HealthResponse)
@router.api_route("/api/health/", methods=["GET", "HEAD"], response_model=HealthResponse, include_in_schema=False)
async def check_health(db: Optional[AsyncSession] = Depends(get_health_db)) -> HealthResponse:
    """
    Comprehensive health check and latency monitoring endpoint.

    Pings the database asynchronously, measures roundtrip query latency in milliseconds,
    and returns overall service and database connection status with ISO 8601 timestamp.
    """
    overall_status = "healthy"
    db_status = "connected"
    latency_ms: Optional[float] = None

    try:
        if db is None:
            raise RuntimeError("Database session unavailable")

        # Ping database with non-blocking async query and 5-second timeout
        start_time = time.perf_counter()
        res = await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=5.0)
        if hasattr(res, "scalar") and callable(res.scalar):
            ping_val = res.scalar()
            if inspect.isawaitable(ping_val):
                ping_val = await ping_val
            if ping_val is not None and ping_val != 1:
                raise RuntimeError(f"Unexpected database ping scalar result: {ping_val}")
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        try:
            await db.rollback()
        except Exception:
            pass
    except Exception as exc:
        logger.warning(f"Database health check probe failed: {exc}")
        overall_status = "degraded"
        db_status = "error"
        latency_ms = None
        if db is not None:
            try:
                await db.rollback()
            except Exception:
                pass

    return HealthResponse(
        status=overall_status,
        database=db_status,
        database_status=db_status,
        database_latency_ms=latency_ms,
        latency_ms=latency_ms,
        timestamp=datetime.now(timezone.utc),
        app="CoreControl",
    )

