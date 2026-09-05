from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional


# --- Food Item Schemas ---

class FoodItemBase(BaseModel):
    name: str
    quantity: float
    unit: str
    calories: int


class FoodItemResponse(FoodItemBase):
    id: int

    class Config:
        from_attributes = True


# --- Meal Schemas ---

class MealCreate(BaseModel):
    raw_input: str = Field(..., min_length=1, max_length=500, description="What did you eat? e.g. '2 eggs, 1 toast, black coffee'")
    meal_type: str = Field(..., pattern="^(breakfast|lunch|dinner|snack)$", description="Type of meal")


class MealResponse(BaseModel):
    id: int
    meal_type: str
    raw_input: str
    total_calories: int
    meal_date: date
    logged_at: datetime
    food_items: list[FoodItemResponse]

    class Config:
        from_attributes = True


# --- Daily Summary ---

class DailySummaryResponse(BaseModel):
    date: date
    total_calories: int
    calorie_goal: int
    remaining: int
    meal_count: int
    meals: list[MealResponse]
