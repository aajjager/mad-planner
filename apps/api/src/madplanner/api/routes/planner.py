from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.api.routes.auth import require_auth
from madplanner.models import MealType
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.recipes import RecipeRepository
from madplanner.schemas.planner import MealPlanEntryResponse, MealPlanEntryWrite, MealSuggestionPreferences, WeeklyMealPlanResponse, WeeklyMealSuggestionsResponse
from madplanner.services.planner import MealPlanService
from madplanner.services.suggestions import MealSuggestionService
from madplanner.services.auth import AuthContext

router = APIRouter(prefix="/meal-plans", tags=["meal plans"])


def get_meal_plan_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> MealPlanService:
    return MealPlanService(MealPlanRepository(session, context.family.id))


def get_suggestion_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> MealSuggestionService:
    return MealSuggestionService(MealPlanRepository(session, context.family.id), RecipeRepository(session, context.family.id))


@router.get("/week", response_model=WeeklyMealPlanResponse)
def get_week(week_start: date, service: Annotated[MealPlanService, Depends(get_meal_plan_service)]):
    return service.get_week(week_start)


@router.post("/week/suggestions", response_model=WeeklyMealSuggestionsResponse)
def suggest_week(week_start: date, preferences: MealSuggestionPreferences, service: Annotated[MealSuggestionService, Depends(get_suggestion_service)]):
    return service.suggest_week(week_start, preferences)


@router.put("/{meal_date}/{meal_type}", response_model=MealPlanEntryResponse)
def assign_meal(meal_date: date, meal_type: MealType, data: MealPlanEntryWrite, service: Annotated[MealPlanService, Depends(get_meal_plan_service)]):
    entry = service.assign(meal_date, meal_type, data)
    if entry is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return entry


@router.delete("/{meal_date}/{meal_type}", status_code=status.HTTP_204_NO_CONTENT)
def remove_meal(meal_date: date, meal_type: MealType, service: Annotated[MealPlanService, Depends(get_meal_plan_service)]) -> Response:
    if not service.remove(meal_date, meal_type):
        raise HTTPException(status_code=404, detail="Planned meal not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{meal_date}/{meal_type}/leftovers", response_model=MealPlanEntryResponse)
def plan_leftovers(meal_date: date, meal_type: MealType, service: Annotated[MealPlanService, Depends(get_meal_plan_service)]):
    entry = service.plan_leftovers(meal_date, meal_type)
    if entry is None:
        raise HTTPException(status_code=404, detail="Source meal not found")
    return entry
