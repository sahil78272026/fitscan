import os
import json
from functools import lru_cache
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND_ENV = os.path.join(_BACKEND_DIR, ".env")


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str

    # Gemini
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # JWT
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 720  # 30 days

    # OTP & Auth
    DEV_OTP: str = ""  # Set to "123456" in local .env only — empty in production
    OTP_EXPIRY_SECONDS: int = 300  # 5 minutes
    FIREBASE_PROJECT_ID: str = "fitscan-54e95"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "serviceAccountKey.json"
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""

    # Upstash Redis
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""

    # Misc
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=(".env", _BACKEND_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("FIREBASE_SERVICE_ACCOUNT_JSON")
    @classmethod
    def validate_firebase_json(cls, v: str) -> str:
        if v and v.strip():
            try:
                parsed = json.loads(v)
                if not isinstance(parsed, dict):
                    raise ValueError("FIREBASE_SERVICE_ACCOUNT_JSON must be a valid JSON object")
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.APP_ENV == "production":
            normalized_level = (self.LOG_LEVEL or "").upper()
            if normalized_level not in ("INFO", "WARNING"):
                raise ValueError(
                    f"In production (APP_ENV='production'), LOG_LEVEL must be strictly 'INFO' or 'WARNING', got '{self.LOG_LEVEL}'"
                )
            self.LOG_LEVEL = normalized_level

            clean_jwt_secret = (self.JWT_SECRET or "").strip()
            if (
                not clean_jwt_secret
                or clean_jwt_secret == "dev-secret-change-in-production"
                or len(clean_jwt_secret) < 32
            ):
                raise ValueError(
                    "In production (APP_ENV='production'), JWT_SECRET must not be empty, whitespace, "
                    "or default ('dev-secret-change-in-production'), and must be at least 32 characters long."
                )
            self.JWT_SECRET = clean_jwt_secret

            if self.DEV_OTP and self.DEV_OTP.strip():
                raise ValueError("In production (APP_ENV='production'), DEV_OTP must be empty.")
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()

