from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from madplanner.importers.json_ld import RecipeParseError
from madplanner.api.routes.auth import get_auth_service, require_recipe_editor
from madplanner.services.auth import AuthContext
from madplanner.services.auth import AuthService
from madplanner.importers.safe_http import RecipeFetchError, UnsafeUrlError
from madplanner.importers.service import RecipeImporter
from madplanner.schemas.imported_recipe import ImportedRecipePreview, RecipeImportRequest
from madplanner.schemas.imported_recipe import CookBookArchivePreview
from madplanner.importers.cookbook import parse_cookbook_archive
from madplanner.repositories.recipes import RecipeRepository
from madplanner.db.session import get_session
from sqlalchemy.orm import Session

router = APIRouter(prefix="/recipe-imports", tags=["recipe imports"])


@router.post("/cookbook/preview", response_model=CookBookArchivePreview)
async def preview_cookbook_archive(request: Request, context: Annotated[AuthContext, Depends(require_recipe_editor)], session: Annotated[Session, Depends(get_session)]):
    content_length = int(request.headers.get("content-length", "0") or 0)
    if content_length > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CookBook exports must be 25 MB or smaller")
    try:
        existing_names = {recipe.name.casefold() for recipe in RecipeRepository(session, context.family.id).list()}
        recipes = parse_cookbook_archive(await request.body(), existing_names)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return CookBookArchivePreview(recipes=recipes)


def get_recipe_importer() -> RecipeImporter:
    return RecipeImporter()


@router.post("/preview", response_model=ImportedRecipePreview)
def preview_recipe(data: RecipeImportRequest, importer: Annotated[RecipeImporter, Depends(get_recipe_importer)], context: Annotated[AuthContext, Depends(require_recipe_editor)], auth_service: Annotated[AuthService, Depends(get_auth_service)]):
    try:
        preview = importer.preview(data.url)
        recipe_types = auth_service.list_recipe_types(context.family.id)
        category_text = (preview.category or "").casefold()
        all_text = " ".join(filter(None, [preview.name, preview.description, preview.category])).casefold()
        aliases = {
            "breakfast": {"breakfast", "morgenmad", "ontbijt", "brunch"},
            "lunch": {"lunch", "frokost"},
            "dinner": {"dinner", "aftensmad", "hovedret", "avondeten"},
            "bake-off": {"bake-off", "bakeoff", "bagværk", "pastry"},
            "cake": {"cake", "kage", "taart"},
            "dessert": {"dessert", "efterret", "nagerecht"},
            "bread": {"bread", "brød", "brood"},
            "snack": {"snack", "mellemmåltid"},
        }
        suggestions = []
        category_match = False
        for item in recipe_types:
            words = aliases.get(item.normalized_name, {item.normalized_name}) | {item.normalized_name}
            if any(word in all_text for word in words):
                suggestions.append(item.name)
                category_match = category_match or any(word in category_text for word in words)
        preview.suggested_recipe_types = suggestions
        preview.recipe_type_confidence = "high" if category_match else "medium" if suggestions else "low"
        return preview
    except UnsafeUrlError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RecipeFetchError, RecipeParseError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
