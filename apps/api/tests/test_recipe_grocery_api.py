import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app


@pytest.fixture
def env():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_session] = session
    client = TestClient(app)
    client.post('/api/v1/auth/setup', json={'email': 'owner@example.com', 'display_name': 'Owner', 'family_name': 'First', 'password': 'long-password-123'})
    recipe = client.post('/api/v1/recipes', json={'name': 'Tomato rice', 'ingredients': [
        {'raw_text': '2 tomatoes', 'ingredient_name': 'tomato', 'quantity': '3', 'quantity_max': '4'},
        {'raw_text': '100 g rice'}, {'raw_text': 'salt'},
    ]}).json()
    recipe = client.get(f"/api/v1/recipes/{recipe['id']}").json()
    try:
        yield client, recipe
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def add(client, recipe, ids):
    return client.post('/api/v1/grocery-lists/week/recipe-ingredients?week_start=2026-11-25', json={'recipe_id': recipe['id'], 'ingredient_ids': ids})


def test_adds_single_and_multiple_ingredients_preserving_structured_values(env):
    client, recipe = env
    first, rice, salt = [item['id'] for item in recipe['ingredients']]
    single = add(client, recipe, [first])
    assert single.status_code == 201
    item = single.json()[0]
    assert item['name'] == 'tomato' and item['quantity'] == '3' and item['quantity_max'] == '4'
    assert item['raw_texts'] == ['2 tomatoes'] and item['recipe_names'] == ['Tomato rice']
    batch = add(client, recipe, [rice, salt, rice])
    assert batch.status_code == 201 and len(batch.json()) == 2
    assert batch.json()[0]['unit']['symbol'] == 'g'
    assert batch.json()[1]['quantity'] is None
    for _ in range(2):
        saved = client.get('/api/v1/grocery-lists/week?week_start=2026-11-23').json()
        assert len(saved['items']) == 3 and saved['planned_meals'] == 0
        assert all(item['origin'] == 'manual' for item in saved['items'])
    assert client.get(f"/api/v1/recipes/{recipe['id']}").json()['ingredients'] == recipe['ingredients']


def test_rejects_invalid_selection_before_adding_any_items(env):
    client, recipe = env
    assert add(client, recipe, [recipe['ingredients'][0]['id'], 999999]).status_code == 422
    assert add(client, recipe, []).status_code == 422
    assert client.get('/api/v1/grocery-lists/week?week_start=2026-11-23').json()['items'] == []


def test_viewers_and_other_families_cannot_add_private_recipe_ingredients(env):
    client, recipe = env
    invitation = client.post('/api/v1/auth/family/invitations', json={'email': 'viewer@example.com', 'role': 'viewer'}).json()
    viewer = TestClient(app)
    viewer.post(f"/api/v1/auth/invitations/{invitation['token']}/accept", json={'display_name': 'Viewer', 'password': 'long-password-456'})
    ids = [recipe['ingredients'][0]['id']]
    assert add(viewer, recipe, ids).status_code == 403
    assert add(TestClient(app), recipe, ids).status_code == 401
    invitation = client.post('/api/v1/auth/families/invitations', json={'email': 'other@example.com', 'family_name': 'Other'}).json()
    other = TestClient(app)
    other.post(f"/api/v1/auth/invitations/{invitation['token']}/accept", json={'display_name': 'Other', 'password': 'long-password-789'})
    assert add(other, recipe, ids).status_code == 404
    client.put(f"/api/v1/recipes/{recipe['id']}/visibility", json={'is_public': True})
    assert add(other, recipe, ids).status_code == 201
    assert client.get('/api/v1/grocery-lists/week?week_start=2026-11-23').json()['items'] == []
