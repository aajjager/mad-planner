from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from madplanner.db.session import get_session
from madplanner.api.routes.auth import require_auth, require_planner_editor
from madplanner.services.auth import AuthContext
from madplanner.repositories.planner import MealPlanRepository
from madplanner.repositories.grocery import GroceryListRepository
from madplanner.schemas.grocery import GroceryListItem, GroceryPurchasedUpdate, ManualGroceryItemCreate, WeeklyGroceryListResponse
from madplanner.services.grocery import GroceryListService
from madplanner.repositories.recipes import RecipeRepository

router = APIRouter(prefix="/grocery-lists", tags=["grocery lists"])


def get_grocery_list_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> GroceryListService:
    return GroceryListService(MealPlanRepository(session, context.family.id), GroceryListRepository(session, context.family.id))


@router.get("/week", response_model=WeeklyGroceryListResponse)
def get_weekly_grocery_list(week_start: date, service: Annotated[GroceryListService, Depends(get_grocery_list_service)]):
    return service.get_week(week_start)


@router.post("/week/items", response_model=GroceryListItem, status_code=status.HTTP_201_CREATED)
def add_manual_grocery_item(week_start: date, data: ManualGroceryItemCreate, service: Annotated[GroceryListService, Depends(get_grocery_list_service)], _permission: Annotated[AuthContext, Depends(require_planner_editor)]):
    return service.add_manual(week_start, data.raw_text)


class RecipeIngredientsCreate(BaseModel):
    recipe_id: int
    ingredient_ids: list[int] = Field(min_length=1, max_length=500)


@router.post('/week/recipe-ingredients', response_model=list[GroceryListItem], status_code=201)
def add_recipe_ingredients(week_start: date, data: RecipeIngredientsCreate, session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_planner_editor)], service: Annotated[GroceryListService, Depends(get_grocery_list_service)]):
    recipe = RecipeRepository(session, context.family.id).get(data.recipe_id)
    if recipe is None:
        raise HTTPException(404, 'Recipe not found')
    selected = set(data.ingredient_ids)
    if not selected.issubset({item.id for item in recipe.ingredients}):
        raise HTTPException(422, 'Select ingredients from this recipe')
    return service.add_recipe_ingredients(week_start, recipe, selected)


@router.patch("/items/{entry_id}/purchased", response_model=GroceryListItem)
def set_grocery_item_purchased(entry_id: int, data: GroceryPurchasedUpdate, service: Annotated[GroceryListService, Depends(get_grocery_list_service)], _permission: Annotated[AuthContext, Depends(require_planner_editor)]):
    entry = service.set_purchased(entry_id, data.purchased)
    if entry is None: raise HTTPException(status_code=404, detail="Grocery item not found")
    return entry
