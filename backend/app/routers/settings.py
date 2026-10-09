import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.settings import (
    CalorieGoalUpdate,
    UserGoalUpdate,
    SettingsResponse,
    SelectMealPlanPayload,
    SubscriptionTierUpdate,
)
from app.services.meal_service import (
    get_or_create_settings,
    update_calorie_goal,
    update_user_goals,
    parse_settings_response_dict,
    save_selected_meal_plan,
    get_plan_change_availability,
)
from app.services.gemini_service import generate_multiple_meal_plans
from app.middleware.auth import get_current_user

logger = logging.getLogger("corecontrol.routers.settings")

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user settings (goals, budget, diet, macros, selected meal plan)."""
    settings = await get_or_create_settings(db, current_user.id)
    return parse_settings_response_dict(settings)


@router.put("/goals", response_model=SettingsResponse)
async def set_user_goals(
    payload: UserGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save user onboarding goals, budget, diet preferences, and auto-calculate daily macros."""
    settings = await update_user_goals(db, current_user.id, payload.model_dump())
    return parse_settings_response_dict(settings)


@router.put("/calorie-goal", response_model=SettingsResponse)
async def set_calorie_goal(
    payload: CalorieGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the daily calorie goal."""
    settings = await update_calorie_goal(db, current_user.id, payload.calorie_goal)
    return parse_settings_response_dict(settings)


@router.post("/meal-plans/suggest")
async def suggest_meal_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate 3 distinct candidate meal plans based on user's current settings."""
    settings = await get_or_create_settings(db, current_user.id)

    # Check 1-change-per-week rate limit for free tier
    can_change, days_left = get_plan_change_availability(settings)
    if not can_change:
        raise HTTPException(
            status_code=403,
            detail=f"Free tier allows 1 meal plan change per week. Next free rotation available in {days_left} day(s). Upgrade to Pro for unlimited changes.",
        )

    try:
        plans_data = await generate_multiple_meal_plans(
            goal_type=settings.goal_type or "fat_loss",
            diet_type=settings.diet_type or "veg",
            budget_tier=settings.budget_tier or "moderate",
            calorie_goal=settings.calorie_goal or 2000,
            protein_goal=settings.protein_goal or 150,
            carbs_goal=settings.carbs_goal or 200,
            fat_goal=settings.fat_goal or 65,
        )
        return plans_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating suggested meal plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meal plans. Please try again.")


@router.put("/meal-plan/select", response_model=SettingsResponse)
async def select_meal_plan(
    payload: SelectMealPlanPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save the user's selected meal plan and update active macro targets."""
    settings = await save_selected_meal_plan(db, current_user.id, payload.meal_plan)
    return parse_settings_response_dict(settings)


@router.put("/subscription", response_model=SettingsResponse)
async def update_subscription_tier(
    payload: SubscriptionTierUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user subscription tier (free or pro)."""
    settings = await get_or_create_settings(db, current_user.id)
    settings.subscription_tier = payload.tier
    await db.commit()
    await db.refresh(settings)
    logger.info(f"User #{current_user.id} subscription tier updated to '{payload.tier}'")
    return parse_settings_response_dict(settings)


