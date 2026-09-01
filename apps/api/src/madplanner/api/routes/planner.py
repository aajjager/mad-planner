from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.api.routes.auth import require_auth, require_planner_editor
from madplanner.models import MealType
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.recipes import RecipeRepository
from madplanner.schemas.planner import MealPlanEntryResponse, MealPlanEntryWrite, MealPlanExclusionResponse, MealSuggestionPreferences, PlanReminderResponse, WeeklyMealPlanResponse, WeeklyMealSuggestionsResponse
from madplanner.services.planner import MealPlanService
from madplanner.services.suggestions import MealSuggestionService
from madplanner.services.auth import AuthContext

router = APIRouter(prefix="/meal-plans", tags=["meal plans"])


def get_meal_plan_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> MealPlanService:
    return MealPlanService(MealPlanRepository(session, context.family.id), context.family.household_size)


def get_suggestion_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> MealSuggestionService:
    return MealSuggestionService(MealPlanRepository(session, context.family.id), RecipeRepository(session, context.family.id), context.family.household_size, context.family.rating_filter_enabled, context.family.rating_minimum, context.family.rating_target_percent)


@router.get("/week", response_model=WeeklyMealPlanResponse)
def get_week(week_start: date, service: Annotated[MealPlanService, Depends(get_meal_plan_service)]):
    return service.get_week(week_start)


@router.get("/reminders", response_model=PlanReminderResponse)
def plan_reminders(service: Annotated[MealPlanService, Depends(get_meal_plan_service)], context: Annotated[AuthContext, Depends(require_auth)]):
    return service.reminders(date.today(), context.family.plan_reminders_enabled, context.family.plan_reminder_weeks, context.family.enabled_meal_types)


@router.post("/week/suggestions", response_model=WeeklyMealSuggestionsResponse)
def suggest_week(week_start: date, preferences: MealSuggestionPreferences, service: Annotated[MealSuggestionService, Depends(get_suggestion_service)], context: Annotated[AuthContext, Depends(require_planner_editor)]):
    preferences.meal_types = [MealType(value) for value in context.family.enabled_meal_types]
    preferences.include_leftover_lunches = (
        preferences.include_leftover_lunches
        and context.family.leftovers_enabled
        and MealType.LUNCH.value in context.family.enabled_meal_types
        and MealType.DINNER.value in context.family.enabled_meal_types
    )
    return service.suggest_week(week_start, preferences)


@router.put("/{meal_date}/{meal_type}", response_model=MealPlanEntryResponse)
def assign_meal(meal_date: date, meal_type: MealType, data: MealPlanEntryWrite, service: Annotated[MealPlanService, Depends(get_meal_plan_service)], context: Annotated[AuthContext, Depends(require_planner_editor)]):
    if meal_type.value not in context.family.enabled_meal_types:
        raise HTTPException(status_code=422, detail="This meal type is disabled in family settings")
    entry = service.assign(meal_date, meal_type, data)
    if entry is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return entry


@router.delete("/{meal_date}/{meal_type}", status_code=status.HTTP_204_NO_CONTENT)
def remove_meal(meal_date: date, meal_type: MealType, service: Annotated[MealPlanService, Depends(get_meal_plan_service)], _permission: Annotated[AuthContext, Depends(require_planner_editor)]) -> Response:
    if not service.remove(meal_date, meal_type):
        raise HTTPException(status_code=404, detail="Planned meal not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{meal_date}/{meal_type}/leftovers", response_model=MealPlanEntryResponse)
def plan_leftovers(meal_date: date, meal_type: MealType, service: Annotated[MealPlanService, Depends(get_meal_plan_service)], context: Annotated[AuthContext, Depends(require_planner_editor)]):
    if not context.family.leftovers_enabled or MealType.LUNCH.value not in context.family.enabled_meal_types:
        raise HTTPException(status_code=422, detail="Leftover lunches are disabled in family settings")
    entry = service.plan_leftovers(meal_date, meal_type)
    if entry is None:
        raise HTTPException(status_code=404, detail="Source meal not found")
    return entry


@router.put("/{meal_date}/{meal_type}/excluded", response_model=MealPlanExclusionResponse)
def exclude_meal(meal_date: date, meal_type: MealType, service: Annotated[MealPlanService, Depends(get_meal_plan_service)], context: Annotated[AuthContext, Depends(require_planner_editor)]):
    if meal_type.value not in context.family.enabled_meal_types:
        raise HTTPException(status_code=422, detail="This meal type is disabled in family settings")
    return service.exclude(meal_date, meal_type)


@router.delete("/{meal_date}/{meal_type}/excluded", status_code=status.HTTP_204_NO_CONTENT)
def include_meal(meal_date: date, meal_type: MealType, service: Annotated[MealPlanService, Depends(get_meal_plan_service)], _permission: Annotated[AuthContext, Depends(require_planner_editor)]) -> Response:
    if not service.include(meal_date, meal_type):
        raise HTTPException(status_code=404, detail="Excluded meal slot not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
