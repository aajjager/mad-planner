from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from madplanner.db.session import get_session
from madplanner.core.config import get_settings
from madplanner.api.routes.auth import require_auth, require_recipe_editor
from madplanner.services.auth import AuthContext
from madplanner.repositories.recipes import RecipeRepository
from madplanner.schemas.recipe import RecipeMealTypesUpdate, RecipeResponse, RecipeWrite
from madplanner.services.recipes import RecipeService

router = APIRouter(prefix="/recipes", tags=["recipes"])
_IMAGE_TYPES = {"image/jpeg": (".jpg", b"\xff\xd8\xff"), "image/png": (".png", b"\x89PNG\r\n\x1a\n"), "image/webp": (".webp", b"RIFF")}


def get_recipe_service(session: Annotated[Session, Depends(get_session)], context: Annotated[AuthContext, Depends(require_auth)]) -> RecipeService:
    return RecipeService(RecipeRepository(session, context.family.id))


@router.get("", response_model=list[RecipeResponse])
def list_recipes(service: Annotated[RecipeService, Depends(get_recipe_service)]):
    return service.list_recipes()


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(data: RecipeWrite, service: Annotated[RecipeService, Depends(get_recipe_service)], _permission: Annotated[AuthContext, Depends(require_recipe_editor)]):
    try:
        return service.create_recipe(data)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, service: Annotated[RecipeService, Depends(get_recipe_service)]):
    recipe = service.get_recipe(recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.put("/{recipe_id}", response_model=RecipeResponse)
def replace_recipe(recipe_id: int, data: RecipeWrite, service: Annotated[RecipeService, Depends(get_recipe_service)], _permission: Annotated[AuthContext, Depends(require_recipe_editor)]):
    try:
        recipe = service.replace_recipe(recipe_id, data)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.patch("/{recipe_id}/meal-types", response_model=RecipeResponse)
def update_recipe_meal_types(recipe_id: int, data: RecipeMealTypesUpdate, service: Annotated[RecipeService, Depends(get_recipe_service)], _permission: Annotated[AuthContext, Depends(require_recipe_editor)]):
    recipe = service.update_meal_types(recipe_id, data)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("/{recipe_id}/image", response_model=RecipeResponse)
async def upload_recipe_image(recipe_id: int, request: Request, service: Annotated[RecipeService, Depends(get_recipe_service)], context: Annotated[AuthContext, Depends(require_recipe_editor)]):
    content_type = request.headers.get("content-type", "").split(";", 1)[0].casefold()
    image_type = _IMAGE_TYPES.get(content_type)
    if image_type is None:
        raise HTTPException(status_code=415, detail="Use a JPEG, PNG, or WebP image")
    content_length = int(request.headers.get("content-length", "0") or 0)
    if content_length > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Recipe images must be 10 MB or smaller")
    content = await request.body()
    extension, signature = image_type
    valid_signature = content.startswith(signature) and (content_type != "image/webp" or len(content) >= 12 and content[8:12] == b"WEBP")
    if not content or len(content) > 10 * 1024 * 1024 or not valid_signature:
        raise HTTPException(status_code=422, detail="The uploaded file is not a valid image")
    if service.get_recipe(recipe_id) is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    relative_path = Path("recipes") / str(context.family.id) / f"{uuid4().hex}{extension}"
    target = get_settings().media_root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    recipe = service.update_image(recipe_id, f"/media/{relative_path.as_posix()}")
    assert recipe is not None
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, service: Annotated[RecipeService, Depends(get_recipe_service)], _permission: Annotated[AuthContext, Depends(require_recipe_editor)]) -> Response:
    if not service.delete_recipe(recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
