import os
import sys
import warnings

warnings.filterwarnings("ignore", category=PendingDeprecationWarning, module="starlette.formparsers")

# Ensure backend directory is in sys.path for test discovery and execution
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# CRITICAL HERMETIC SAFETY LOCK:
# Tests must NEVER touch any remote, production, or local development database.
# Hard-force in-memory SQLite for all test executions, overriding any local .env file.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ.setdefault("GEMINI_API_KEY", "test_dummy_gemini_key")
os.environ.setdefault("RAZORPAY_KEY_ID", "mock_key_id")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "mock_secret")
os.environ["UPSTASH_REDIS_REST_URL"] = ""
os.environ["UPSTASH_REDIS_REST_TOKEN"] = ""
os.environ["DEV_OTP"] = ""

# Clear cached settings so Pydantic picks up the test environment variables immediately
try:
    from app.config import get_settings
    get_settings.cache_clear()
    test_settings = get_settings()
    if not test_settings.DATABASE_URL.startswith("sqlite"):
        raise RuntimeError(
            f"CRITICAL SAFETY VIOLATION: Test suite attempted to run against non-SQLite database URL: {test_settings.DATABASE_URL}"
        )
except ImportError:
    pass
