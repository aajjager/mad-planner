from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from madplanner.api.routes.auth import require_recipe_editor
from madplanner.schemas.recipe_scan import RecipeScanPreview
from madplanner.services.auth import AuthContext
from madplanner.services.recipe_scan import RecipeScanService

router = APIRouter(prefix="/recipe-scans", tags=["recipe scans"])
_SIGNATURES = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n", "image/webp": b"RIFF"}


@router.post("/preview", response_model=RecipeScanPreview)
async def scan_recipe_preview(request: Request, _permission: Annotated[AuthContext, Depends(require_recipe_editor)]):
    content_type = request.headers.get("content-type", "").split(";", 1)[0].casefold()
    signature = _SIGNATURES.get(content_type)
    image = await request.body()
    valid = signature is not None and image.startswith(signature) and (content_type != "image/webp" or len(image) >= 12 and image[8:12] == b"WEBP")
    if not valid:
        raise HTTPException(status_code=415, detail="Use a JPEG, PNG, or WebP image")
    if len(image) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Scanned pages must be 15 MB or smaller")
    try:
        return RecipeScanService().preview(image)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
