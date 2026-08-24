from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from madplanner.importers.json_ld import RecipeParseError
from madplanner.api.routes.auth import require_recipe_editor
from madplanner.services.auth import AuthContext
from madplanner.importers.safe_http import RecipeFetchError, UnsafeUrlError
from madplanner.importers.service import RecipeImporter
from madplanner.schemas.imported_recipe import ImportedRecipePreview, RecipeImportRequest

router = APIRouter(prefix="/recipe-imports", tags=["recipe imports"])


def get_recipe_importer() -> RecipeImporter:
    return RecipeImporter()


@router.post("/preview", response_model=ImportedRecipePreview)
def preview_recipe(data: RecipeImportRequest, importer: Annotated[RecipeImporter, Depends(get_recipe_importer)], _context: Annotated[AuthContext, Depends(require_recipe_editor)]):
    try:
        return importer.preview(data.url)
    except UnsafeUrlError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RecipeFetchError, RecipeParseError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
