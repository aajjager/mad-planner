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

    tagged = client.patch(f"/api/v1/recipes/{recipe_id}/tags", json={"tags": ["Mexican", "potato", " mexican "]})
    assert tagged.status_code == 200
    assert tagged.json()["tags"] == ["Mexican", "potato"]
    assert client.get(f"/api/v1/recipes/{recipe_id}").json()["tags"] == ["Mexican", "potato"]

    rated = client.put(f"/api/v1/recipes/{recipe_id}/rating", json={"rating": 5})
    assert rated.status_code == 200
    assert rated.json()["my_rating"] == 5
    assert rated.json()["family_rating"] == 5
    assert rated.json()["rating_count"] == 1

    cleared = client.put(f"/api/v1/recipes/{recipe_id}/rating", json={"rating": None})
    assert cleared.status_code == 200
    assert cleared.json()["my_rating"] is None
    assert cleared.json()["family_rating"] is None

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


def test_recipe_reuses_repeated_ingredients_in_one_request(client: TestClient) -> None:
    response = client.post(
        "/api/v1/recipes",
        json={
            "name": "CookBook crispy chicken",
            "ingredients": [
                {"raw_text": "1 tsp salt"},
                {"raw_text": "1 tsp white pepper"},
                {"raw_text": "1 tsp salt"},
            ],
        },
    )

    assert response.status_code == 201
    ingredients = response.json()["ingredients"]
    assert len(ingredients) == 3
    assert ingredients[0]["ingredient_name"] == ingredients[2]["ingredient_name"]


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


def test_recipe_can_be_shared_without_copying_it(client: TestClient) -> None:
    created = client.post("/api/v1/recipes", json={"name": "Family pasta"})
    recipe_id = created.json()["id"]

    provisioned = client.post("/api/v1/auth/families/invitations", json={"family_name": "Vibe family", "email": "vibe@example.com"})
    assert provisioned.status_code == 201
    recipient_client = TestClient(app)
    accepted = recipient_client.post(f"/api/v1/auth/invitations/{provisioned.json()['token']}/accept", json={"display_name": "Vibe", "password": "test-password-456"})
    assert accepted.status_code == 201
    assert accepted.json()["is_system_admin"] is False
    assert recipient_client.get("/api/v1/auth/admin/families").status_code == 403

    targets = client.get("/api/v1/recipes/sharing/families")
    assert targets.status_code == 200
    assert len(targets.json()) == 1
    recipient_id = targets.json()[0]["id"]
    assert targets.json()[0]["name"] == "Vibe family"

    shared = client.put(f"/api/v1/recipes/{recipe_id}/shares", json={"family_ids": [recipient_id]})
    assert shared.status_code == 200
    assert shared.json()["shared_with_family_ids"] == [recipient_id]
    assert shared.json()["shared_with_families"] == ["Vibe family"]
    received = recipient_client.get(f"/api/v1/recipes/{recipe_id}")
    assert received.status_code == 200
    assert received.json()["owned_by_current_family"] is False
    assert received.json()["owner_family_name"] == "Test family"
    assert recipient_client.put(f"/api/v1/recipes/{recipe_id}", json={"name": "Changed"}).status_code == 404
    assert recipient_client.put(f"/api/v1/recipes/{recipe_id}/rating", json={"rating": 4}).json()["family_rating"] == 4
    assert client.get(f"/api/v1/recipes/{recipe_id}").json()["family_rating"] is None

    assert client.delete(f"/api/v1/recipes/{recipe_id}").status_code == 204
    assert recipient_client.get(f"/api/v1/recipes/{recipe_id}").status_code == 404


def test_public_recipe_can_be_browsed_and_imported_as_independent_copy(client: TestClient) -> None:
    created = client.post("/api/v1/recipes", json={"name": "Public tacos", "tags": ["Mexican"], "meal_types": ["dinner"], "ingredients": [{"raw_text": "8 tortillas"}], "instructions": [{"text": "Fill tortillas."}]})
    recipe_id = created.json()["id"]
    assert client.put(f"/api/v1/recipes/{recipe_id}/visibility", json={"is_public": True}).json()["is_public"] is True
    provisioned = client.post("/api/v1/auth/families/invitations", json={"family_name": "Import family", "email": "import@example.com"})
    recipient = TestClient(app)
    recipient.post(f"/api/v1/auth/invitations/{provisioned.json()['token']}/accept", json={"display_name": "Importer", "password": "test-password-456"})
    assert [item["name"] for item in recipient.get("/api/v1/recipes/public").json()] == ["Public tacos"]
    imported = recipient.post(f"/api/v1/recipes/public/{recipe_id}/import")
    assert imported.status_code == 201
    assert imported.json()["id"] != recipe_id
    assert imported.json()["tags"] == ["Mexican"]
    client.delete(f"/api/v1/recipes/{recipe_id}")
    assert recipient.get(f"/api/v1/recipes/{imported.json()['id']}").status_code == 200


def test_recipe_metadata_suggestions_understand_danish_ingredients(client: TestClient) -> None:
    recipe = client.post("/api/v1/recipes", json={"name": "Kyllingetacos", "ingredients": [{"raw_text": "8 tortillas"}, {"raw_text": "400 g kylling"}]})
    suggestions = client.post(f"/api/v1/recipes/{recipe.json()['id']}/metadata-suggestions")
    assert suggestions.status_code == 200
    assert "Mexican" in suggestions.json()["tags"]
    assert "Chicken" in suggestions.json()["tags"]
    assert "dinner" in suggestions.json()["meal_types"]


def test_owned_recipes_can_be_updated_in_bulk(client: TestClient) -> None:
    first = client.post("/api/v1/recipes", json={"name": "First", "tags": ["Old"]}).json()
    second = client.post("/api/v1/recipes", json={"name": "Second", "tags": ["Old", "Keep"]}).json()
    updated = client.patch("/api/v1/recipes/bulk", json={"recipe_ids": [first["id"], second["id"]], "is_public": True, "add_tags": ["Winter"], "remove_tags": ["Old"]})
    assert updated.status_code == 200
    assert {item["name"]: item["tags"] for item in updated.json()} == {"First": ["Winter"], "Second": ["Keep", "Winter"]}
    assert all(item["is_public"] is True for item in updated.json())


def test_bulk_update_rejects_a_recipe_not_owned_by_the_family(client: TestClient) -> None:
    recipe = client.post("/api/v1/recipes", json={"name": "Owner only"}).json()
    provisioned = client.post("/api/v1/auth/families/invitations", json={"family_name": "Other family", "email": "other@example.com"})
    recipient = TestClient(app)
    recipient.post(f"/api/v1/auth/invitations/{provisioned.json()['token']}/accept", json={"display_name": "Other", "password": "test-password-456"})
    assert recipient.patch("/api/v1/recipes/bulk", json={"recipe_ids": [recipe["id"]], "is_public": True}).status_code == 422
