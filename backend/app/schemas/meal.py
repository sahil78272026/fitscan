from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional


# --- Food Item Schemas ---

class FoodItemBase(BaseModel):
    name: str
    quantity: float
    unit: str
    calories: int
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0


class FoodItemResponse(FoodItemBase):
    id: int

    class Config:
        from_attributes = True


# --- Meal Schemas ---

class MealCreate(BaseModel):
    raw_input: str = Field(..., min_length=1, max_length=500, description="What did you eat? e.g. '2 eggs, 1 toast, black coffee'")
    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner|snack)$", description="Type of meal")
    meal_date: Optional[date] = Field(None, description="Target date for the meal (YYYY-MM-DD)")


class MealResponse(BaseModel):
    id: int
    meal_type: str
    raw_input: str
    total_calories: int
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0
    image_url: Optional[str] = None
    meal_date: date
    logged_at: datetime
    food_items: list[FoodItemResponse]

    class Config:
        from_attributes = True


# --- Daily Summary ---

class DailySummaryResponse(BaseModel):
    date: date
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fat: float
    calorie_goal: int
    protein_goal: int
    carbs_goal: int
    fat_goal: int
    remaining_calories: int
    remaining_protein: float
    remaining_carbs: float
    remaining_fat: float
    meal_count: int
    meals: list[MealResponse]


# --- Meal Recommendations ---

class MealRecommendationOption(BaseModel):
    dish_name: str
    meal_type: str
    estimated_cost: str
    calories: int
    protein: float
    carbs: float
    fat: float
    description: str
    recipe_summary: str

class MealRecommendationResponse(BaseModel):
    budget_tier: str
    diet_type: str
    recommendations: list[MealRecommendationOption]

