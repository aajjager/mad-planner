from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.api.routes.auth import require_auth, require_planner_editor
from madplanner.services.auth import AuthContext
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.grocery import GroceryListRepository
from madplanner.schemas.grocery import GroceryListItem, GroceryPurchasedUpdate, ManualGroceryItemCreate, WeeklyGroceryListResponse
from madplanner.services.grocery import GroceryListService

router = APIRouter(prefix="/grocery-lists", tags=["grocery lists"])


def get_grocery_list_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> GroceryListService:
    return GroceryListService(MealPlanRepository(session, context.family.id), GroceryListRepository(session, context.family.id))


@router.get("/week", response_model=WeeklyGroceryListResponse)
def get_weekly_grocery_list(week_start: date, service: Annotated[GroceryListService, Depends(get_grocery_list_service)]):
    return service.get_week(week_start)


@router.post("/week/items", response_model=GroceryListItem, status_code=status.HTTP_201_CREATED)
def add_manual_grocery_item(week_start: date, data: ManualGroceryItemCreate, service: Annotated[GroceryListService, Depends(get_grocery_list_service)], _permission: Annotated[AuthContext, Depends(require_planner_editor)]):
    return service.add_manual(week_start, data.raw_text)


@router.patch("/items/{entry_id}/purchased", response_model=GroceryListItem)
def set_grocery_item_purchased(entry_id: int, data: GroceryPurchasedUpdate, service: Annotated[GroceryListService, Depends(get_grocery_list_service)], _permission: Annotated[AuthContext, Depends(require_planner_editor)]):
    entry = service.set_purchased(entry_id, data.purchased)
    if entry is None: raise HTTPException(status_code=404, detail="Grocery item not found")
    return entry
