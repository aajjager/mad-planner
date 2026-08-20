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
        test_client = TestClient(app)
        setup = test_client.post("/api/v1/auth/setup", json={"email": "owner@example.com", "display_name": "Owner", "password": "test-password-123", "family_name": "Test family"})
        assert setup.status_code == 201
        yield test_client
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


def test_plan_next_day_lunch_as_leftovers(client: TestClient) -> None:
    recipe_id = client.get("/api/v1/recipes").json()[0]["id"]
    source = client.put("/api/v1/meal-plans/2026-08-19/dinner", json={"recipe_id": recipe_id}).json()

    response = client.post("/api/v1/meal-plans/2026-08-19/dinner/leftovers")

    assert response.status_code == 200
    assert response.json()["meal_date"] == "2026-08-20"
    assert response.json()["meal_type"] == "lunch"
    assert response.json()["is_leftover"] is True
    assert response.json()["source_entry_id"] == source["id"]
    assert response.json()["recipe"]["id"] == recipe_id


def test_suggest_week_returns_reviewable_varied_dinners_and_leftovers(client: TestClient) -> None:
    client.post("/api/v1/recipes", json={"name": "Quick curry", "category": "Aftensmad", "tags": ["Quick"], "meal_types": ["dinner"], "total_time_minutes": 25, "ingredients": [{"raw_text": "1 stk. løg"}]})
    client.post("/api/v1/recipes", json={"name": "Slow stew", "category": "Aftensmad", "total_time_minutes": 120, "ingredients": [{"raw_text": "1 stk. løg"}]})
    client.post("/api/v1/recipes", json={"name": "Quick porridge", "tags": ["Quick"], "meal_types": ["breakfast"], "total_time_minutes": 10})

    response = client.post(
        "/api/v1/meal-plans/week/suggestions",
        params={"week_start": "2026-08-17"},
        json={"meal_types": ["dinner"], "preferred_tags": ["Quick"], "max_cooking_time_minutes": 30, "include_leftover_lunches": True},
    )

    assert response.status_code == 200
    payload = response.json()
    dinners = [item for item in payload["suggestions"] if item["meal_type"] == "dinner"]
    leftovers = [item for item in payload["suggestions"] if item["is_leftover"]]
    assert len(dinners) == 7
    assert len(leftovers) == 6
    assert {item["recipe"]["name"] for item in dinners} == {"Quick curry"}
    assert all("quick" in " ".join(item["reasons"]).lower() for item in dinners)
    assert client.get("/api/v1/meal-plans/week", params={"week_start": "2026-08-17"}).json()["entries"] == []
