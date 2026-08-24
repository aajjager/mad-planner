from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from madplanner.api.router import api_router
from madplanner.core.config import get_settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mad Planner API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.include_router(api_router, prefix="/api/v1")
    app.mount("/media", StaticFiles(directory=get_settings().media_root, check_dir=False), name="media")
    return app


app = create_app()
