from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.api.routes.auth import require_auth
from madplanner.services.auth import AuthContext
from madplanner.repositories.planner import MealPlanRepository
from madplanner.schemas.grocery import WeeklyGroceryListResponse
from madplanner.services.grocery import GroceryListService

router = APIRouter(prefix="/grocery-lists", tags=["grocery lists"])


def get_grocery_list_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> GroceryListService:
    return GroceryListService(MealPlanRepository(session, context.family.id))


@router.get("/week", response_model=WeeklyGroceryListResponse)
def get_weekly_grocery_list(week_start: date, service: Annotated[GroceryListService, Depends(get_grocery_list_service)]):
    return service.get_week(week_start)
