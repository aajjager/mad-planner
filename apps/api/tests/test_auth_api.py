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


def setup_owner(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/setup",
        json={
            "email": "owner@example.com",
            "display_name": "Owner",
            "password": "correct-horse-battery-staple",
            "family_name": "Example family",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_owner_setup_login_and_logout(client: TestClient) -> None:
    assert client.get("/api/v1/auth/status").json() == {"setup_required": True}
    owner = setup_owner(client)
    assert owner["role"] == "owner"
    assert client.get("/api/v1/auth/status").json() == {"setup_required": False}
    assert client.get("/api/v1/auth/me").json()["family_name"] == "Example family"
    settings = client.get("/api/v1/auth/family/settings")
    assert settings.json() == {"household_size": 2, "leftovers_enabled": True, "cooking_mode_enabled": True, "enabled_meal_types": ["breakfast", "lunch", "dinner"]}
    updated = client.put("/api/v1/auth/family/settings", json={"household_size": 3, "leftovers_enabled": False, "cooking_mode_enabled": False, "enabled_meal_types": ["dinner"]})
    assert updated.status_code == 200
    assert updated.json()["household_size"] == 3
    assert updated.json()["enabled_meal_types"] == ["dinner"]
    assert client.post("/api/v1/auth/setup", json={"email": "second@example.com", "display_name": "Second", "password": "another-long-password", "family_name": "Other"}).status_code == 409

    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "OWNER@example.com", "password": "correct-horse-battery-staple"}).status_code == 200


def test_owner_can_invite_a_family_member(client: TestClient) -> None:
    setup_owner(client)
    invitation = client.post("/api/v1/auth/family/invitations", json={"email": "member@example.com"})
    assert invitation.status_code == 201
    token = invitation.json()["token"]
    assert invitation.json()["family_name"] == "Example family"
    assert client.get(f"/api/v1/auth/invitations/{token}").status_code == 200

    accepted = client.post(
        f"/api/v1/auth/invitations/{token}/accept",
        json={"display_name": "Member", "password": "member-password-123"},
    )
    assert accepted.status_code == 201
    assert accepted.json()["role"] == "editor"
    assert accepted.json()["family_name"] == "Example family"
    assert client.get(f"/api/v1/auth/invitations/{token}").status_code == 404

    members = client.get("/api/v1/auth/family/members")
    assert members.status_code == 200
    assert {member["email"] for member in members.json()} == {"owner@example.com", "member@example.com"}
    member_id = next(member["id"] for member in members.json() if member["role"] == "editor")
    assert client.get("/api/v1/auth/admin/invitations").status_code == 403

    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "correct-horse-battery-staple"}).status_code == 200
    changed_role = client.patch(f"/api/v1/auth/admin/members/{member_id}/role", json={"role": "viewer"})
    assert changed_role.status_code == 200
    assert changed_role.json()["role"] == "viewer"
    assert client.post("/api/v1/auth/login", json={"email": "member@example.com", "password": "member-password-123"}).status_code == 200
    assert client.get("/api/v1/recipes").status_code == 200
    assert client.post("/api/v1/recipes", json={"name": "Forbidden recipe"}).status_code == 403
    assert client.put("/api/v1/meal-plans/2026-08-24/dinner", json={"recipe_id": 1}).status_code == 403
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "correct-horse-battery-staple"}).status_code == 200
    members = client.get("/api/v1/auth/family/members").json()
    assert next(member for member in members if member["id"] == member_id)["active_sessions"] == 2
    assert client.post(f"/api/v1/auth/admin/members/{member_id}/revoke-sessions").status_code == 204
    members = client.get("/api/v1/auth/family/members").json()
    assert next(member for member in members if member["id"] == member_id)["active_sessions"] == 0

    pending = client.post("/api/v1/auth/family/invitations", json={"email": "pending@example.com"})
    assert pending.status_code == 201
    invitations = client.get("/api/v1/auth/admin/invitations")
    assert invitations.status_code == 200
    assert invitations.json()[0]["intended_email"] == "pending@example.com"
    assert client.delete(f"/api/v1/auth/admin/invitations/{invitations.json()[0]['id']}").status_code == 204

    assert client.delete(f"/api/v1/auth/admin/members/{member_id}").status_code == 204
    assert client.post("/api/v1/auth/login", json={"email": "member@example.com", "password": "member-password-123"}).status_code == 401


def test_domain_endpoints_require_authentication(client: TestClient) -> None:
    assert client.get("/api/v1/recipes").status_code == 401
    assert client.get("/api/v1/meal-plans/week", params={"week_start": "2026-08-17"}).status_code == 401
    assert client.get("/api/v1/grocery-lists/week", params={"week_start": "2026-08-17"}).status_code == 401
