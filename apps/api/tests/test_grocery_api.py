from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app
from madplanner.models import RecipeIngredient


def test_weekly_grocery_list_combines_and_scales_ingredients() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)

    def override_session():
        with Session(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        client = TestClient(app)
        recipe = client.post("/api/v1/recipes", json={
            "name": "Simple pasta", "servings": "2",
            "ingredients": [{"raw_text": "200 g pasta"}, {"raw_text": "salt"}],
        }).json()
        # Simulate an ingredient saved before automatic parsing was introduced.
        with Session(engine) as session:
            pasta = session.query(RecipeIngredient).filter_by(raw_text="200 g pasta").one()
            pasta.ingredient_id = None
            pasta.unit_id = None
            pasta.quantity = None
            session.commit()
        client.put("/api/v1/meal-plans/2026-08-17/dinner", json={"recipe_id": recipe["id"], "servings": "4"})
        client.post("/api/v1/meal-plans/2026-08-17/dinner/leftovers")
        client.put("/api/v1/meal-plans/2026-08-19/dinner", json={"recipe_id": recipe["id"], "servings": "2"})

        response = client.get("/api/v1/grocery-lists/week", params={"week_start": "2026-08-19"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["week_start"] == "2026-08-17"
    assert payload["planned_meals"] == 2
    pasta = next(item for item in payload["items"] if item["name"] == "pasta")
    assert pasta["quantity"] == "600"
    assert pasta["unit"]["symbol"] == "g"
    assert pasta["recipe_names"] == ["Simple pasta"]
    salt = next(item for item in payload["items"] if item["name"] == "salt")
    assert salt["quantity"] is None
