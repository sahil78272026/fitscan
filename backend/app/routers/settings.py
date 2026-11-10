import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.meal import Meal
from app.models.weight import WeightLog
from app.models.step import StepLog
from app.schemas.settings import (
    CalorieGoalUpdate,
    UserGoalUpdate,
    SettingsResponse,
    SelectMealPlanPayload,
    SubscriptionTierUpdate,
    MealPlanSwapRequest,
    ResetDataPayload,
    ResetDataResponse,
)
from app.services.meal_service import (
    get_or_create_settings,
    update_calorie_goal,
    update_user_goals,
    parse_settings_response_dict,
    save_selected_meal_plan,
    get_plan_change_availability,
    swap_meal_plan_slots,
    save_meal_plan_reorder,
)
from app.services.gemini_service import generate_multiple_meal_plans
from app.services.redis_service import cache_delete
from app.middleware.auth import get_current_user, require_active_subscription

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
    try:
        await cache_delete(f"user:{current_user.id}:daily_summary:{date.today().isoformat()}")
    except Exception:
        pass
    return parse_settings_response_dict(settings)


@router.put("/calorie-goal", response_model=SettingsResponse)
async def set_calorie_goal(
    payload: CalorieGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the daily calorie goal."""
    settings = await update_calorie_goal(db, current_user.id, payload.calorie_goal)
    try:
        await cache_delete(f"user:{current_user.id}:daily_summary:{date.today().isoformat()}")
    except Exception:
        pass
    return parse_settings_response_dict(settings)


@router.put("/morning-briefing", response_model=SettingsResponse)
async def set_morning_briefing_preferences(
    payload: UserGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update morning briefing schedule, frequency, or toggle status."""
    settings = await update_user_goals(db, current_user.id, payload.model_dump(exclude_unset=True))
    return parse_settings_response_dict(settings)


@router.post("/meal-plans/suggest")
async def suggest_meal_plans(
    current_user: User = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    """Generate 3 distinct candidate meal plans based on user's current settings."""
    settings = await get_or_create_settings(db, current_user.id)

    # Check 1-change-per-24h rate limit to optimize Gemini AI calls
    can_change, hours_left, days_left = get_plan_change_availability(settings)
    if not can_change:
        raise HTTPException(
            status_code=429,
            detail=f"Meal plans can be updated once every 24 hours to optimize AI generation. Next update available in {hours_left} hour(s).",
        )

    try:
        plans_data = await generate_multiple_meal_plans(
            goal_type=settings.goal_type or "fat_loss",
            diet_type=settings.diet_type or "veg",
            budget_tier=settings.budget_tier or "moderate",
            workout_time=getattr(settings, "workout_time", "evening") or "evening",
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
    current_user: User = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    """Save the user's selected meal plan and update active macro targets."""
    settings = await save_selected_meal_plan(db, current_user.id, payload.meal_plan)
    return parse_settings_response_dict(settings)


@router.post("/meal-plan/swap", response_model=SettingsResponse)
async def swap_meal_plan(
    payload: MealPlanSwapRequest,
    current_user: User = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    """
    Swap slots in the active meal plan or sync a reordered meal plan.
    Critical: Does NOT trigger or consume the 24-hour meal plan suggestion cooldown.
    """
    if payload.source_meal_type and payload.target_meal_type:
        settings = await swap_meal_plan_slots(
            db=db,
            user_id=current_user.id,
            source_meal_type=payload.source_meal_type,
            target_meal_type=payload.target_meal_type,
        )
    elif payload.meal_plan:
        settings = await save_meal_plan_reorder(
            db=db,
            user_id=current_user.id,
            meal_plan=payload.meal_plan,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Either source_meal_type & target_meal_type or meal_plan must be provided."
        )

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


@router.post("/reset-data", response_model=ResetDataResponse)
async def reset_user_data(
    payload: ResetDataPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Safely reset personal log history for the current user without deleting their account.
    Requires explicit confirmation == 'RESET'.
    Scope options: 'all_logs', 'meals', 'weights', 'steps'.
    """
    cleared_count = 0

    if payload.scope in ("all_logs", "meals"):
        res = await db.execute(delete(Meal).where(Meal.user_id == current_user.id))
        cleared_count += res.rowcount or 0

    if payload.scope in ("all_logs", "weights"):
        res = await db.execute(delete(WeightLog).where(WeightLog.user_id == current_user.id))
        cleared_count += res.rowcount or 0

    if payload.scope in ("all_logs", "steps"):
        res = await db.execute(delete(StepLog).where(StepLog.user_id == current_user.id))
        cleared_count += res.rowcount or 0

    await db.commit()

    try:
        await cache_delete(f"user:{current_user.id}:daily_summary:{date.today().isoformat()}")
    except Exception:
        pass

    logger.info(f"User #{current_user.id} reset scope '{payload.scope}' ({cleared_count} records cleared).")

    return ResetDataResponse(
        message=f"Successfully reset {payload.scope} records.",
        scope=payload.scope,
        records_cleared=cleared_count,
    )



