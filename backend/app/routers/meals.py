import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.meal import MealCreate, MealResponse, MealRecommendationResponse
from app.services.meal_service import create_meal, get_meals_by_date, delete_meal, get_or_create_settings
from app.services.gemini_service import recommend_curated_meals
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
    """Log a new meal with text input. Text is analyzed by Gemini AI for calorie & macro breakdown."""
    try:
        meal = await create_meal(
            db=db,
            user_id=current_user.id,
            raw_input=payload.raw_input,
            meal_type=payload.meal_type,
            target_meal_date=payload.meal_date
        )
        return meal
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to log meal: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food: {str(e)}")


@router.post("/scan-image", response_model=MealResponse, status_code=201)
async def scan_meal_image(
    image: UploadFile = File(...),
    raw_input: Optional[str] = Form(None),
    meal_type: str = Form("lunch"),
    meal_date: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a meal using a food image + optional text description. Gemini Multimodal parses calories and macros."""
    try:
        image_bytes = await image.read()
        mime_type = image.content_type or "image/jpeg"

        target_date = date.fromisoformat(meal_date) if meal_date else date.today()

        meal = await create_meal(
            db=db,
            user_id=current_user.id,
            raw_input=raw_input or f"Scanned {meal_type} photo",
            meal_type=meal_type,
            target_meal_date=target_date,
            image_bytes=image_bytes,
            mime_type=mime_type
        )
        return meal
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to scan meal image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@router.get("/recommendations", response_model=MealRecommendationResponse)
async def get_meal_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch curated market meal recommendations matched to user budget, diet preference, and macro targets."""
    settings = await get_or_create_settings(db, current_user.id)
    try:
        recs = await recommend_curated_meals(
            goal_type=settings.goal_type or "fat_loss",
            diet_type=settings.diet_type or "veg",
            budget_tier=settings.budget_tier or "moderate",
            calorie_goal=settings.calorie_goal or 2000
        )
        return recs
    except Exception as e:
        logger.error(f"Failed to fetch meal recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Could not generate recommendations: {str(e)}")


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

