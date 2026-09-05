from pydantic import BaseModel, Field


class CalorieGoalUpdate(BaseModel):
    calorie_goal: int = Field(..., gt=0, le=10000, description="Daily calorie target")


class SettingsResponse(BaseModel):
    calorie_goal: int

    class Config:
        from_attributes = True
