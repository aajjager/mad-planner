from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.repositories.recipes import RecipeRepository
from madplanner.schemas.recipe import RecipeResponse, RecipeWrite
from madplanner.services.recipes import RecipeService

router = APIRouter(prefix="/recipes", tags=["recipes"])


def get_recipe_service(session: Annotated[Session, Depends(get_session)]) -> RecipeService:
    return RecipeService(RecipeRepository(session))


@router.get("", response_model=list[RecipeResponse])
def list_recipes(service: Annotated[RecipeService, Depends(get_recipe_service)]):
    return service.list_recipes()


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(data: RecipeWrite, service: Annotated[RecipeService, Depends(get_recipe_service)]):
    return service.create_recipe(data)


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, service: Annotated[RecipeService, Depends(get_recipe_service)]):
    recipe = service.get_recipe(recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.put("/{recipe_id}", response_model=RecipeResponse)
def replace_recipe(recipe_id: int, data: RecipeWrite, service: Annotated[RecipeService, Depends(get_recipe_service)]):
    recipe = service.replace_recipe(recipe_id, data)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, service: Annotated[RecipeService, Depends(get_recipe_service)]) -> Response:
    if not service.delete_recipe(recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
