from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
from typing import Optional, List


class StepLogCreate(BaseModel):
    step_count: int = Field(..., ge=0, description="Step count taken for the day")
    calories_burned: Optional[float] = Field(default=None, ge=0, description="Calories burned (e.g. from Health Connect)")
    logged_date: Optional[date] = Field(default=None, description="Date for step log (defaults to today)")


class StepLogResponse(BaseModel):
    id: int
    user_id: int
    step_count: int
    calories_burned: float
    logged_date: date
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StepHistoryResponse(BaseModel):
    logs: List[StepLogResponse]
    total_steps_7d: int
    average_steps_7d: int
