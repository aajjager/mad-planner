from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app
from madplanner.models import Recipe


@pytest.fixture
def client() -> TestClient:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Recipe(name="Monday pasta"))
        session.commit()

    def override_session():
        with Session(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_assign_replace_and_remove_planned_meal(client: TestClient) -> None:
    recipes = client.get("/api/v1/recipes").json()
    recipe_id = recipes[0]["id"]

    assigned = client.put(
        "/api/v1/meal-plans/2026-08-19/dinner",
        json={"recipe_id": recipe_id, "servings": "4", "notes": "Make extra"},
    )
    assert assigned.status_code == 200
    assert assigned.json()["recipe"]["name"] == "Monday pasta"
    assert assigned.json()["meal_type"] == "dinner"

    replaced = client.put(
        "/api/v1/meal-plans/2026-08-19/dinner",
        json={"recipe_id": recipe_id, "servings": "2"},
    )
    assert replaced.status_code == 200
    assert replaced.json()["servings"] == "2"

    assert client.delete("/api/v1/meal-plans/2026-08-19/dinner").status_code == 204
    assert client.delete("/api/v1/meal-plans/2026-08-19/dinner").status_code == 404


def test_week_is_normalized_to_monday_and_includes_entries(client: TestClient) -> None:
    recipe_id = client.get("/api/v1/recipes").json()[0]["id"]
    client.put("/api/v1/meal-plans/2026-08-19/lunch", json={"recipe_id": recipe_id})

    response = client.get("/api/v1/meal-plans/week", params={"week_start": date(2026, 8, 19).isoformat()})

    assert response.status_code == 200
    assert response.json()["week_start"] == "2026-08-17"
    assert response.json()["week_end"] == "2026-08-23"
    assert len(response.json()["entries"]) == 1


def test_assign_rejects_unknown_recipe(client: TestClient) -> None:
    response = client.put("/api/v1/meal-plans/2026-08-19/dinner", json={"recipe_id": 999})

    assert response.status_code == 404
