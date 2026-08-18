from fastapi import APIRouter

from madplanner.api.routes.health import router as health_router
from madplanner.api.routes.recipes import router as recipes_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(recipes_router)
