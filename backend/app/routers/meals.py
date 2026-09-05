import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.meal import MealCreate, MealResponse
from app.services.meal_service import create_meal, get_meals_by_date, delete_meal
from app.middleware.auth import get_current_user
from datetime import date

logger = logging.getLogger("fitscan.routers.meals")

router = APIRouter(prefix="/api/meals", tags=["Meals"])


@router.post("", response_model=MealResponse, status_code=201)
async def log_meal(
    payload: MealCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a new meal. Text is analyzed by Gemini AI for calorie breakdown."""
    try:
        meal = await create_meal(db, current_user.id, payload.raw_input, payload.meal_type, payload.meal_date)
        return meal
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to log meal: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food: {str(e)}")


@router.get("/today", response_model=list[MealResponse])
async def get_meals_today(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all meals logged today."""
    meals = await get_meals_by_date(db, current_user.id, date.today())
    return meals


@router.delete("/{meal_id}", status_code=204)
async def remove_meal(
    meal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a meal by ID (must be owned by current user)."""
    deleted = await delete_meal(db, current_user.id, meal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meal not found")
