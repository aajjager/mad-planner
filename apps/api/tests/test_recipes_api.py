import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app


@pytest.fixture
def client() -> TestClient:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)

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


def test_recipe_crud(client: TestClient) -> None:
    payload = {
        "name": "Onion soup", "servings": "4", "cuisine": "French", "tags": ["Dinner", "Comfort food", "dinner"], "meal_types": ["lunch", "dinner"],
        "ingredients": [{"raw_text": "2 large onions, sliced", "ingredient_name": "Onion", "quantity": "2", "unit": {"name": "piece", "symbol": "pc", "dimension": "count"}, "preparation": "sliced"}],
        "instructions": [{"text": "Slice the onions."}],
    }
    created = client.post("/api/v1/recipes", json=payload)
    assert created.status_code == 201
    recipe_id = created.json()["id"]
    assert created.json()["ingredients"][0]["ingredient_name"] == "Onion"
    assert created.json()["tags"] == ["Comfort food", "Dinner"]
    assert created.json()["meal_types"] == ["lunch", "dinner"]

    assert [item["name"] for item in client.get("/api/v1/recipes").json()] == ["Onion soup"]
    assert client.get(f"/api/v1/recipes/{recipe_id}").status_code == 200

    payload["name"] = "French onion soup"
    payload["instructions"] = [{"text": "Slice."}, {"text": "Simmer."}]
    replaced = client.put(f"/api/v1/recipes/{recipe_id}", json=payload)
    assert replaced.status_code == 200
    assert [step["position"] for step in replaced.json()["instructions"]] == [1, 2]

    classified = client.patch(f"/api/v1/recipes/{recipe_id}/meal-types", json={"meal_types": ["breakfast", "lunch"]})
    assert classified.status_code == 200
    assert classified.json()["meal_types"] == ["breakfast", "lunch"]

    assert client.delete(f"/api/v1/recipes/{recipe_id}").status_code == 204
    assert client.get(f"/api/v1/recipes/{recipe_id}").status_code == 404


def test_recipe_validation_and_not_found(client: TestClient) -> None:
    invalid = client.post("/api/v1/recipes", json={"name": "Invalid", "ingredients": [{"raw_text": "2-1 onions", "quantity": "2", "quantity_max": "1"}]})
    assert invalid.status_code == 422
    assert client.get("/api/v1/recipes/999").status_code == 404
    assert client.put("/api/v1/recipes/999", json={"name": "Missing"}).status_code == 404
    assert client.delete("/api/v1/recipes/999").status_code == 404


def test_openapi_includes_recipe_endpoints(client: TestClient) -> None:
    response = client.get("/api/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/recipes" in response.json()["paths"]


def test_recipe_create_parses_raw_ingredient_text(client: TestClient) -> None:
    response = client.post(
        "/api/v1/recipes",
        json={"name": "Imported recipe", "ingredients": [{"raw_text": "2 stk. æg"}]},
    )

    assert response.status_code == 201
    ingredient = response.json()["ingredients"][0]
    assert ingredient["raw_text"] == "2 stk. æg"
    assert ingredient["ingredient_name"] == "æg"
    assert ingredient["quantity"] == "2"
    assert ingredient["unit"] == {"name": "piece", "symbol": "stk", "dimension": "count"}


def test_recipe_estimates_nutrition_from_recognized_ingredients(client: TestClient) -> None:
    response = client.post("/api/v1/recipes", json={"name": "Simple meal", "servings": "2", "ingredients": [{"raw_text": "200 g kylling"}, {"raw_text": "100 g broccoli"}]})

    assert response.status_code == 201
    nutrition = response.json()["nutrition"]
    assert nutrition["estimated"] is True
    assert nutrition["coveragePercent"] == 100
    assert nutrition["calories"] > 0
    assert nutrition["proteinContent"] > 0


def test_supplied_nutrition_takes_priority_over_estimate(client: TestClient) -> None:
    supplied = {"calories": "123 kcal", "fatContent": "4 g", "carbohydrateContent": "5 g", "proteinContent": "6 g"}
    response = client.post("/api/v1/recipes", json={"name": "Labelled meal", "nutrition": supplied, "ingredients": [{"raw_text": "200 g kylling"}]})

    assert response.status_code == 201
    assert response.json()["nutrition"] == supplied


def test_metadata_only_nutrition_uses_ingredient_estimate(client: TestClient) -> None:
    response = client.post("/api/v1/recipes", json={"name": "Incomplete website nutrition", "servings": "4", "nutrition": {"@type": "NutritionInformation"}, "ingredients": [{"raw_text": "400 g pasta"}, {"raw_text": "500 g kyllingebryst"}]})

    assert response.status_code == 201
    assert response.json()["nutrition"]["estimated"] is True
    assert response.json()["nutrition"]["coveragePercent"] == 100
