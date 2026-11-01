import base64
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.database import get_db
from app.models.user import User
from app.schemas.meal import (
    MealCreate,
    MealUpdate,
    MealResponse,
    MealRecommendationResponse,
    ScanImageBase64Request,
)
from app.services.meal_service import (
    create_meal,
    update_meal,
    get_meals_by_date,
    delete_meal,
    get_or_create_settings,
)
from app.services.gemini_service import recommend_curated_meals
from app.middleware.auth import get_current_user

logger = logging.getLogger("corecontrol.routers.meals")

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
            target_meal_date=payload.meal_date,
            image_url=payload.image_url,
        )
        return meal
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to log meal: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food: {str(e)}")


@router.post("/scan-image-base64", response_model=MealResponse, status_code=201)
async def scan_meal_image_base64(
    payload: ScanImageBase64Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a meal using Base64 encoded food image JSON payload supporting JPEG, PNG, WebP, GIF, and HEIC."""
    try:
        b64_str = payload.photo_base64.strip()
        mime_type = "image/jpeg"

        # Extract MIME type from data URI if provided (e.g., data:image/png;base64,...)
        if b64_str.startswith("data:") and ";base64," in b64_str:
            header, b64_str = b64_str.split(";base64,", 1)
            extracted_mime = header.replace("data:", "").strip().lower()
            if extracted_mime in ("image/jpg", "image/pjpeg"):
                mime_type = "image/jpeg"
            elif extracted_mime.startswith("image/"):
                mime_type = extracted_mime
        elif "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]

        try:
            image_bytes = base64.b64decode(b64_str)
        except Exception as decode_err:
            raise HTTPException(status_code=422, detail=f"Invalid base64 image encoding: {decode_err}")

        if not image_bytes or len(image_bytes) == 0:
            raise HTTPException(status_code=422, detail="Decoded image data is empty")

        target_date = date.fromisoformat(payload.meal_date) if payload.meal_date else date.today()

        meal = await create_meal(
            db=db,
            user_id=current_user.id,
            raw_input=payload.raw_input or f"Scanned {payload.meal_type} photo",
            meal_type=payload.meal_type,
            target_meal_date=target_date,
            image_bytes=image_bytes,
            mime_type=mime_type,
            image_url=payload.image_url,
        )
        return meal
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to scan base64 meal image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@router.post("/scan-image", response_model=MealResponse, status_code=201)
async def scan_meal_image(
    image: UploadFile = File(...),
    raw_input: Optional[str] = Form(None),
    meal_type: str = Form("lunch"),
    meal_date: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a meal using multipart form upload supporting JPEG, PNG, WebP, GIF, and HEIC formats."""
    if meal_type not in ("breakfast", "lunch", "dinner", "snack"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid meal_type '{meal_type}'. Must be one of: breakfast, lunch, dinner, snack",
        )

    try:
        image_bytes = await image.read()
        if not image_bytes or len(image_bytes) == 0:
            raise HTTPException(status_code=422, detail="Uploaded image file is empty")

        mime_type = (image.content_type or "image/jpeg").lower()
        if mime_type in ("image/jpg", "image/pjpeg"):
            mime_type = "image/jpeg"

        target_date = date.fromisoformat(meal_date) if meal_date else date.today()

        meal = await create_meal(
            db=db,
            user_id=current_user.id,
            raw_input=raw_input or f"Scanned {meal_type} photo",
            meal_type=meal_type,
            target_meal_date=target_date,
            image_bytes=image_bytes,
            mime_type=mime_type,
            image_url=image_url,
        )
        return meal
    except HTTPException:
        raise
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


@router.patch("/{meal_id}", response_model=MealResponse)
async def update_meal_endpoint(
    meal_id: int,
    payload: MealUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Reclassify or update a logged meal's meal_type, raw_input, or meal_date.
    Ensures user summary, recent items, and calendar caches are invalidated across affected dates.
    """
    try:
        updated_meal = await update_meal(
            db=db,
            user_id=current_user.id,
            meal_id=meal_id,
            meal_type=payload.meal_type,
            raw_input=payload.raw_input,
            meal_date=payload.meal_date,
            image_url=payload.image_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not updated_meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return updated_meal

