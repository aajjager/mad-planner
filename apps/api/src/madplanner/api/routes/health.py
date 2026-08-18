from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel

from madplanner.db.session import check_database_connection

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok", "unavailable"]
    service: str
    database: Literal["connected", "not_checked", "unavailable"]


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="madplanner-api",
        database="not_checked",
    )


@router.get("/health/ready", response_model=HealthResponse)
async def readiness(
    response: Response,
    database_is_connected: Annotated[bool, Depends(check_database_connection)],
) -> HealthResponse:
    if not database_is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="unavailable",
            service="madplanner-api",
            database="unavailable",
        )

    return HealthResponse(
        status="ok",
        service="madplanner-api",
        database="connected",
    )
