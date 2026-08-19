from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.models import MealType
from madplanner.repositories.planner import MealPlanRepository
from madplanner.schemas.planner import MealPlanEntryResponse, MealPlanEntryWrite, WeeklyMealPlanResponse
from madplanner.services.planner import MealPlanService

router = APIRouter(prefix="/meal-plans", tags=["meal plans"])


def get_meal_plan_service(session: Annotated[Session, Depends(get_session)]) -> MealPlanService:
    return MealPlanService(MealPlanRepository(session))


@router.get("/week", response_model=WeeklyMealPlanResponse)
def get_week(week_start: date, service: Annotated[MealPlanService, Depends(get_meal_plan_service)]):
    return service.get_week(week_start)


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
