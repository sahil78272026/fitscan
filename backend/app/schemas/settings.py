from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, Any, Dict

class UserGoalUpdate(BaseModel):
    goal_type: str = Field("fat_loss", pattern="^(fat_loss|weight_loss|muscle_building|muscle_maintain)$")
    diet_type: str = Field("veg", pattern="^(veg|non_veg|vegan|eggetarian)$")
    budget_tier: str = Field("moderate", pattern="^(low_budget|moderate|flexible)$")
    age: Optional[int] = Field(None, ge=10, le=100)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    height_cm: Optional[float] = Field(None, ge=50, le=250)
    activity_level: Optional[str] = Field("moderate", pattern="^(sedentary|light|moderate|very_active)$")
    workout_time: Optional[str] = Field("evening", pattern="^(morning|afternoon|evening|night|none)$")
    # Optional manual macro overrides:
    calorie_goal: Optional[int] = Field(None, gt=0, le=10000)
    protein_goal: Optional[int] = Field(None, gt=0, le=1000)
    carbs_goal: Optional[int] = Field(None, gt=0, le=1000)
    fat_goal: Optional[int] = Field(None, gt=0, le=1000)
    # Morning Briefing Preferences:
    morning_briefing_enabled: Optional[bool] = None
    morning_briefing_start_hour: Optional[int] = Field(None, ge=0, le=23)
    morning_briefing_end_hour: Optional[int] = Field(None, ge=0, le=23)
    morning_briefing_frequency: Optional[str] = Field(None, pattern="^(daily|weekdays|weekly)$")


class MorningBriefingPreferencesUpdate(BaseModel):
    enabled: bool = True
    start_hour: int = Field(6, ge=0, le=23)
    end_hour: int = Field(11, ge=0, le=23)
    frequency: str = Field("daily", pattern="^(daily|weekdays|weekly)$")


class CalorieGoalUpdate(BaseModel):
    calorie_goal: int = Field(..., gt=0, le=10000, description="Daily calorie target")


class SelectMealPlanPayload(BaseModel):
    meal_plan: Dict[str, Any] = Field(..., description="The meal plan object selected by user")


class MealPlanSwapRequest(BaseModel):
    source_meal_type: Optional[str] = Field(
        None,
        description="Source meal slot identifier to swap (e.g. 'breakfast' or 'Breakfast')"
    )
    target_meal_type: Optional[str] = Field(
        None,
        description="Target meal slot identifier to swap (e.g. 'lunch' or 'Lunch')"
    )
    meal_plan: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional full reordered meal plan dictionary for direct drag-and-drop synchronization"
    )

    @model_validator(mode="after")
    def validate_swap_payload(self) -> "MealPlanSwapRequest":
        has_pair = bool(self.source_meal_type and self.target_meal_type)
        has_plan = bool(self.meal_plan)
        if not has_pair and not has_plan:
            raise ValueError("Either both 'source_meal_type' and 'target_meal_type' must be provided, or 'meal_plan' must be provided.")
        if has_pair and self.source_meal_type.strip().lower() == self.target_meal_type.strip().lower():
            raise ValueError("source_meal_type and target_meal_type cannot be identical.")
        return self


class MealPlanItemSchema(BaseModel):
    meal_type: str = Field(..., description="Meal slot: Breakfast, Lunch, Snack, Dinner")
    dish_name: str = Field(..., description="Concise 2-3 word dish name")
    calories: int = Field(..., ge=0, description="Calories in kcal")
    protein: float = Field(..., ge=0.0, description="Protein in grams")
    carbs: float = Field(..., ge=0.0, description="Carbs in grams")
    fat: float = Field(..., ge=0.0, description="Fat in grams")
    priority: str = Field("medium", pattern="^(high|medium|low)$", description="Visual priority tier")
    timing_badge: str = Field("Sustained Energy", description="Timing/contextual badge")
    ingredients: Optional[list[str]] = Field(default_factory=list, description="Ingredient list with breakdown")
    description: Optional[str] = Field(None, description="Short prep instruction")

    model_config = ConfigDict(from_attributes=True, extra="allow")


class SubscriptionTierUpdate(BaseModel):
    tier: str = Field(..., pattern="^(free|pro)$")


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
    start_weight_kg: Optional[float] = None
    activity_level: Optional[str] = "moderate"
    workout_time: Optional[str] = "evening"
    selected_meal_plan: Optional[Any] = None
    subscription_tier: Optional[str] = "free"
    last_plan_change_at: Optional[datetime] = None
    can_change_plan: bool = True
    days_until_next_plan_change: int = 0
    hours_until_next_plan_change: int = 0
    morning_briefing_enabled: bool = True
    morning_briefing_start_hour: int = 6
    morning_briefing_end_hour: int = 11
    morning_briefing_frequency: str = "daily"

    model_config = ConfigDict(from_attributes=True)

