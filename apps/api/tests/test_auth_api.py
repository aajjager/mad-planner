import pytest
import pyotp
from cryptography.fernet import Fernet
from pydantic import SecretStr
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app
from madplanner.core.config import get_settings


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
    assert owner["show_nutrition"] is True
    assert owner["browser_notifications_enabled"] is False
    preferences = client.patch(
        "/api/v1/auth/me/preferences",
        json={"show_nutrition": False, "browser_notifications_enabled": True},
    )
    assert preferences.status_code == 200
    assert preferences.json()["show_nutrition"] is False
    assert preferences.json()["browser_notifications_enabled"] is True
    assert client.get("/api/v1/auth/status").json() == {"setup_required": False}
    assert client.get("/api/v1/auth/me").json()["family_name"] == "Example family"
    settings = client.get("/api/v1/auth/family/settings")
    assert settings.json() == {"household_size": 2, "leftovers_enabled": True, "cooking_mode_enabled": True, "plan_reminders_enabled": True, "plan_reminder_weeks": 1, "enabled_meal_types": ["breakfast", "lunch", "dinner"]}
    updated = client.put("/api/v1/auth/family/settings", json={"household_size": 3, "leftovers_enabled": False, "cooking_mode_enabled": False, "plan_reminders_enabled": False, "plan_reminder_weeks": 3, "enabled_meal_types": ["dinner"]})
    assert updated.status_code == 200
    assert updated.json()["household_size"] == 3
    assert updated.json()["enabled_meal_types"] == ["dinner"]
    assert updated.json()["plan_reminders_enabled"] is False
    assert updated.json()["plan_reminder_weeks"] == 3
    recipe_types = client.get("/api/v1/auth/family/recipe-types")
    assert recipe_types.status_code == 200
    assert {item["name"] for item in recipe_types.json()} >= {"Breakfast", "Dinner", "Cake", "Bake-off"}
    custom_type = client.post("/api/v1/auth/family/recipe-types", json={"name": "Soup", "meal_type": "dinner"})
    assert custom_type.status_code == 201
    assert custom_type.json()["name"] == "Soup"
    assert client.delete(f"/api/v1/auth/family/recipe-types/{custom_type.json()['id']}").status_code == 204
    assert client.post("/api/v1/auth/setup", json={"email": "second@example.com", "display_name": "Second", "password": "another-long-password", "family_name": "Other"}).status_code == 409

    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "OWNER@example.com", "password": "correct-horse-battery-staple"}).status_code == 200
    events = client.get("/api/v1/auth/admin/security-events")
    assert events.status_code == 200
    assert [item["event_type"] for item in events.json()[:2]] == ["login_succeeded", "login_failed"]
    assert all(item["user_email"] == "owner@example.com" for item in events.json())


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


def test_owner_can_issue_single_use_password_reset(client: TestClient) -> None:
    owner = setup_owner(client)
    reset = client.post(f"/api/v1/auth/admin/members/{owner['id']}/password-reset")
    assert reset.status_code == 200
    token = reset.json()["token"]
    assert client.get(f"/api/v1/auth/password-resets/{token}").json()["intended_email"] == "owner@example.com"
    assert client.post(f"/api/v1/auth/password-resets/{token}", json={"password": "new-secure-password"}).status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post(f"/api/v1/auth/password-resets/{token}", json={"password": "another-secure-password"}).status_code == 404
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "correct-horse-battery-staple"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "new-secure-password"}).status_code == 200


def test_owner_can_enroll_totp_mfa(client: TestClient) -> None:
    get_settings().mfa_encryption_key = SecretStr(Fernet.generate_key().decode())
    setup_owner(client)
    enrollment = client.post("/api/v1/auth/me/mfa/enroll")
    assert enrollment.status_code == 200
    assert enrollment.json()["provisioning_uri"].startswith("otpauth://totp/")
    assert client.post("/api/v1/auth/me/mfa/confirm", json={"code": "000000"}).status_code == 400
    confirmed = client.post("/api/v1/auth/me/mfa/confirm", json={"code": pyotp.TOTP(enrollment.json()["secret"]).now()})
    assert confirmed.status_code == 200
    assert len(confirmed.json()["recovery_codes"]) == 10
    assert client.get("/api/v1/auth/me").json()["mfa_enabled"] is True
    recovery_code = confirmed.json()["recovery_codes"][0]
    client.post("/api/v1/auth/logout")
    challenge = client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "correct-horse-battery-staple"})
    assert challenge.json()["mfa_required"] is True
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/login/mfa", json={"challenge_token": challenge.json()["challenge_token"], "code": "000000"}).status_code == 401
    signed_in = client.post("/api/v1/auth/login/mfa", json={"challenge_token": challenge.json()["challenge_token"], "code": pyotp.TOTP(enrollment.json()["secret"]).now()})
    assert signed_in.status_code == 200
    client.post("/api/v1/auth/logout")
    recovery_challenge = client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "correct-horse-battery-staple"}).json()
    assert client.post("/api/v1/auth/login/mfa", json={"challenge_token": recovery_challenge["challenge_token"], "code": recovery_code}).status_code == 200
    assert client.post("/api/v1/auth/me/mfa/disable", json={"password": "wrong"}).status_code == 401
    disabled = client.post("/api/v1/auth/me/mfa/disable", json={"password": "correct-horse-battery-staple"})
    assert disabled.status_code == 200
    assert disabled.json()["mfa_enabled"] is False
