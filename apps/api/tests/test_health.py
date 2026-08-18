from fastapi.testclient import TestClient

from madplanner.api.routes.health import check_database_connection
from madplanner.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "madplanner-api",
        "database": "not_checked",
    }


def test_readiness_when_database_is_connected() -> None:
    app.dependency_overrides[check_database_connection] = lambda: True

    try:
        response = client.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "madplanner-api",
        "database": "connected",
    }


def test_readiness_when_database_is_unavailable() -> None:
    app.dependency_overrides[check_database_connection] = lambda: False

    try:
        response = client.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "service": "madplanner-api",
        "database": "unavailable",
    }
