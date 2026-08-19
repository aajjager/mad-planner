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
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_recipe_crud(client: TestClient) -> None:
    payload = {
        "name": "Onion soup", "servings": "4", "cuisine": "French",
        "ingredients": [{"raw_text": "2 large onions, sliced", "ingredient_name": "Onion", "quantity": "2", "unit": {"name": "piece", "symbol": "pc", "dimension": "count"}, "preparation": "sliced"}],
        "instructions": [{"text": "Slice the onions."}],
    }
    created = client.post("/api/v1/recipes", json=payload)
    assert created.status_code == 201
    recipe_id = created.json()["id"]
    assert created.json()["ingredients"][0]["ingredient_name"] == "Onion"

    assert [item["name"] for item in client.get("/api/v1/recipes").json()] == ["Onion soup"]
    assert client.get(f"/api/v1/recipes/{recipe_id}").status_code == 200

    payload["name"] = "French onion soup"
    payload["instructions"] = [{"text": "Slice."}, {"text": "Simmer."}]
    replaced = client.put(f"/api/v1/recipes/{recipe_id}", json=payload)
    assert replaced.status_code == 200
    assert [step["position"] for step in replaced.json()["instructions"]] == [1, 2]

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
