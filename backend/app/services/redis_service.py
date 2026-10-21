import asyncio
import json
import logging
from typing import Any, Optional
import httpx
from app.config import get_settings

logger = logging.getLogger("corecontrol.redis")

_client: Optional[httpx.AsyncClient] = None


def get_redis_client() -> Optional[httpx.AsyncClient]:
    """Get or initialize singleton async HTTP client for Upstash Redis REST API."""
    global _client
    settings = get_settings()

    if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
        return None

    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    client_needs_refresh = (
        _client is None
        or _client.is_closed
        or (getattr(_client, "_custom_loop", None) is not current_loop)
    )

    if client_needs_refresh:
        _client = httpx.AsyncClient(
            base_url=settings.UPSTASH_REDIS_REST_URL.rstrip("/"),
            headers={
                "Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(3.0, connect=2.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
        )
        _client._custom_loop = current_loop

    return _client


async def close_redis_client():
    """Gracefully close Redis HTTP client pool on app shutdown."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


async def cache_get(key: str) -> Optional[Any]:
    """
    Retrieve and deserialize a JSON/string value from Redis.
    Fails safely returning None on timeout or error.
    """
    client = get_redis_client()
    if not client:
        return None

    try:
        resp = await client.post("/", json=["GET", key])
        if resp.status_code == 200:
            result = resp.json().get("result")
            if result is None:
                return None
            try:
                return json.loads(result)
            except (ValueError, TypeError):
                return result
        else:
            logger.warning(f"Upstash GET {key} failed: status {resp.status_code}")
            return None
    except Exception as exc:
        logger.warning(f"Upstash GET exception for {key}: {exc}")
        return None


async def cache_set(key: str, value: Any, ex: Optional[int] = None) -> bool:
    """
    Serialize and store value in Redis with optional TTL (in seconds).
    Fails safely returning False on error.
    """
    client = get_redis_client()
    if not client:
        return False

    try:
        val_str = json.dumps(value) if not isinstance(value, str) else value
        cmd = ["SET", key, val_str]
        if ex and ex > 0:
            cmd.extend(["EX", str(int(ex))])

        resp = await client.post("/", json=cmd)
        if resp.status_code == 200 and resp.json().get("result") == "OK":
            return True
        logger.warning(f"Upstash SET {key} failed: status {resp.status_code}")
        return False
    except Exception as exc:
        logger.warning(f"Upstash SET exception for {key}: {exc}")
        return False


async def cache_delete(*keys: str) -> bool:
    """
    Delete one or more keys from Redis.
    """
    valid_keys = [k for k in keys if k]
    if not valid_keys:
        return True

    client = get_redis_client()
    if not client:
        return False

    try:
        cmd = ["DEL"] + valid_keys
        resp = await client.post("/", json=cmd)
        return resp.status_code == 200
    except Exception as exc:
        logger.warning(f"Upstash DEL exception for {keys}: {exc}")
        return False


async def cache_delete_pattern(pattern: str) -> bool:
    """
    Find and delete all keys matching pattern (e.g. 'user:42:*').
    """
    client = get_redis_client()
    if not client:
        return False

    try:
        resp = await client.post("/", json=["KEYS", pattern])
        if resp.status_code == 200:
            keys = resp.json().get("result", [])
            if keys and isinstance(keys, list):
                return await cache_delete(*keys)
        return True
    except Exception as exc:
        logger.warning(f"Upstash pattern delete exception for {pattern}: {exc}")
        return False
