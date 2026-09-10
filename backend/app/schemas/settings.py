from pydantic import BaseModel, Field
from typing import Optional, Any, Dict

class UserGoalUpdate(BaseModel):
    goal_type: str = Field("fat_loss", pattern="^(fat_loss|weight_loss|muscle_building|muscle_maintain)$")
    diet_type: str = Field("veg", pattern="^(veg|non_veg|vegan|eggetarian)$")
    budget_tier: str = Field("moderate", pattern="^(low_budget|moderate|flexible)$")
    age: Optional[int] = Field(None, ge=10, le=100)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    height_cm: Optional[float] = Field(None, ge=50, le=250)
    weight_kg: Optional[float] = Field(None, ge=20, le=300)
    activity_level: Optional[str] = Field("moderate", pattern="^(sedentary|light|moderate|very_active)$")
    # Optional manual macro overrides:
    calorie_goal: Optional[int] = Field(None, gt=0, le=10000)
    protein_goal: Optional[int] = Field(None, gt=0, le=1000)
    carbs_goal: Optional[int] = Field(None, gt=0, le=1000)
    fat_goal: Optional[int] = Field(None, gt=0, le=1000)


class CalorieGoalUpdate(BaseModel):
    calorie_goal: int = Field(..., gt=0, le=10000, description="Daily calorie target")


class SelectMealPlanPayload(BaseModel):
    meal_plan: Dict[str, Any] = Field(..., description="The meal plan object selected by user")


class SettingsResponse(BaseModel):
    calorie_goal: int
    protein_goal: int
    carbs_goal: int
    fat_goal: int
    goal_type: Optional[str] = "fat_loss"
    diet_type: Optional[str] = "veg"
    budget_tier: Optional[str] = "moderate"
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    activity_level: Optional[str] = "moderate"
    selected_meal_plan: Optional[Any] = None

    class Config:
        from_attributes = True

