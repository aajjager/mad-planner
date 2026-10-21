from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from threading import Event, Thread

from madplanner.api.router import api_router
from madplanner.core.config import get_settings
from madplanner.services.push import configured, run_dispatcher


@asynccontextmanager
async def lifespan(app):
    stop = Event()
    thread = None
    if configured(get_settings()):
        thread = Thread(target=run_dispatcher, args=(stop, get_settings()), daemon=True)
        thread.start()
    yield
    stop.set()
    if thread:
        # Do not block shutdown on a slow network request. The daemon exits with API.
        thread.join(timeout=1)


def create_app() -> FastAPI:
    app = FastAPI(
        lifespan=lifespan,
        title="Mad Planner API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.include_router(api_router, prefix="/api/v1")
    app.mount("/media", StaticFiles(directory=get_settings().media_root, check_dir=False), name="media")
    return app


app = create_app()
