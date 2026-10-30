import math
from datetime import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator


class HealthResponse(BaseModel):
    """Strict Pydantic v2 schema for backend health and database latency monitoring."""

    model_config = ConfigDict(from_attributes=True)

    status: Literal["healthy", "degraded"] = Field(
        ...,
        description="Overall service status ('healthy' or 'degraded')",
        examples=["healthy", "degraded"],
    )
    database: Literal["connected", "error"] = Field(
        ...,
        description="Database connection status ('connected' or 'error')",
        examples=["connected", "error"],
    )
    database_latency_ms: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Database query roundtrip latency in milliseconds",
        examples=[1.45],
    )
    timestamp: datetime = Field(
        ...,
        description="Server timestamp in ISO 8601 format",
    )
    database_status: Optional[Literal["connected", "error"]] = Field(
        default=None,
        description="Database connection status alias",
    )
    latency_ms: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Database roundtrip latency in milliseconds alias",
    )
    app: Optional[str] = Field(
        default="CoreControl",
        description="Application name",
    )

    @model_validator(mode="before")
    @classmethod
    def populate_alias_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "database" not in data and "database_status" in data:
                data["database"] = data["database_status"]
            if "database_latency_ms" not in data and "latency_ms" in data:
                data["database_latency_ms"] = data["latency_ms"]
        return data

    @model_validator(mode="after")
    def validate_health_state(self) -> "HealthResponse":
        if self.database_latency_ms is not None and not math.isfinite(self.database_latency_ms):
            raise ValueError("database_latency_ms must be a finite number")
        if self.latency_ms is not None and not math.isfinite(self.latency_ms):
            raise ValueError("latency_ms must be a finite number")

        if self.status == "healthy":
            if self.database != "connected":
                raise ValueError("Healthy status requires database to be 'connected'")
            if self.database_latency_ms is None:
                raise ValueError("Healthy status requires a valid numeric database_latency_ms")

        if self.database == "connected":
            if self.database_latency_ms is None:
                raise ValueError("Connected status requires a valid numeric database_latency_ms")

        if self.database == "error":
            if self.database_latency_ms is not None:
                raise ValueError("Database in error status cannot have a database_latency_ms value")
            if self.latency_ms is not None:
                raise ValueError("Database in error status cannot have a latency_ms value")

        if self.database_status is None:
            self.database_status = self.database
        elif self.database_status != self.database:
            raise ValueError(
                f"database_status alias ('{self.database_status}') must match database ('{self.database}')"
            )

        if self.latency_ms is None:
            self.latency_ms = self.database_latency_ms
        elif (
            self.database_latency_ms is not None
            and self.latency_ms != self.database_latency_ms
        ):
            raise ValueError(
                f"latency_ms alias ({self.latency_ms}) must match database_latency_ms ({self.database_latency_ms})"
            )
        return self
