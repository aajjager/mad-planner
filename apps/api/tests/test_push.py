import base64
from datetime import UTC, datetime, timedelta

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from madplanner.core.config import get_settings
from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app
from madplanner.models import FeedbackSubmission, User, UserSession
from madplanner.models.push import PushSubscription
from madplanner.services.push import dispatch, send_push, validate_endpoint


def subscription():
    key = ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
    return {'endpoint': 'https://fcm.googleapis.com/fcm/send/test-device', 'keys': {'p256dh': encode(key), 'auth': encode(b'a' * 16)}}


@pytest.fixture
def env(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    def db_session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_session] = db_session
    settings = get_settings()
    for key, value in {'push_enabled': True, 'push_vapid_private_key': SecretStr('test-key'), 'push_vapid_public_key': 'test-public', 'push_vapid_subject': 'mailto:admin@example.com'}.items():
        monkeypatch.setattr(settings, key, value)
    client = TestClient(app)
    client.post('/api/v1/auth/setup', json={'email': 'owner@example.com', 'display_name': 'Owner', 'family_name': 'Test', 'password': 'long-password-123'})
    try:
        yield client, engine, settings
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_authenticated_device_registration_disable_and_key_validation(env):
    client, engine, settings = env
    data = subscription()
    assert client.get('/api/v1/push/config').json() == {'enabled': True, 'public_key': 'test-public'}
    assert client.post('/api/v1/push/subscriptions', json=data).status_code == 201
    assert client.post('/api/v1/push/subscriptions', json=data).status_code == 201
    with Session(engine) as db:
        assert len(db.scalars(select(PushSubscription)).all()) == 1
    assert client.post('/api/v1/push/status', json={'endpoint': data['endpoint']}).json()['subscribed']
    assert client.post('/api/v1/push/subscriptions', json={**data, 'keys': {**data['keys'], 'p256dh': 'x' * 87}}).status_code == 422
    assert client.request('DELETE', '/api/v1/push/subscriptions', json={'endpoint': data['endpoint']}).status_code == 204
    assert not client.post('/api/v1/push/status', json={'endpoint': data['endpoint']}).json()['subscribed']
    settings.push_enabled = False
    assert client.get('/api/v1/push/config').json() == {'enabled': False, 'public_key': None}
    assert client.post('/api/v1/push/subscriptions', json=data).status_code == 503
    client.cookies.clear()
    assert client.get('/api/v1/push/config').status_code == 401


@pytest.mark.parametrize('url', ['http://fcm.googleapis.com/test', 'https://127.0.0.1/test', 'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com:8443/x', 'https://user@web.push.apple.com/x', 'https://localhost/x', 'https://evil.test/x'])
def test_registration_rejects_arbitrary_server_side_destinations(url):
    with pytest.raises(ValueError):
        validate_endpoint(url)


def test_subscription_ownership_and_logout(env):
    client, engine, settings = env
    data = subscription()
    client.post('/api/v1/push/subscriptions', json=data)
    other = TestClient(app)
    other.post('/api/v1/auth/login', json={'email': 'owner@example.com', 'password': 'long-password-123'})
    assert not other.post('/api/v1/push/status', json={'endpoint': data['endpoint']}).json()['subscribed']
    other.request('DELETE', '/api/v1/push/subscriptions', json={'endpoint': data['endpoint']})
    assert client.post('/api/v1/push/status', json={'endpoint': data['endpoint']}).json()['subscribed']
    client.post('/api/v1/auth/logout')
    with Session(engine) as db:
        dispatch(db, settings, sender=lambda *_: pytest.fail('Logged-out device received a push'))
        assert not db.scalars(select(PushSubscription)).all()


def test_dispatch_deduplicates_translates_scopes_and_respects_preferences(env):
    client, engine, settings = env
    client.post('/api/v1/push/subscriptions', json=subscription())
    now = datetime.now(UTC).replace(hour=12)
    delivered = []
    def send(sub, payload, _):
        delivered.append(payload)
        return 'sent'
    with Session(engine) as db:
        user = db.get(User, 1)
        user.locale = 'da'
        user.browser_notifications_enabled = True
        sub = db.scalar(select(PushSubscription))
        sub.created_at = now - timedelta(days=1)
        session = db.get(UserSession, sub.session_id)
        session.expires_at = now + timedelta(days=2)
        db.add(FeedbackSubmission(user_id=1, family_id=1, content='Private request content', status='done', category='improvement', completed_at=now))
        db.add(FeedbackSubmission(user_id=1, family_id=1, content='Expired', status='done', category='bug', completed_at=now-timedelta(days=6)))
        db.add(FeedbackSubmission(user_id=999, family_id=1, content='Another account', status='done', category='bug', completed_at=now))
        db.add(FeedbackSubmission(user_id=1, family_id=999, content='Another family', status='done', category='bug', completed_at=now))
        db.commit()
        assert dispatch(db, settings, now=now, sender=send) == 2
        assert dispatch(db, settings, now=now, sender=send) == 0
        assert {p['url'].split('?')[0] for p in delivered} == {'/family', '/planner'}
        assert all('Private request content' not in str(p) for p in delivered)
        assert delivered[0]['title'] == 'Din kommende madplan mangler måltider'
        user.browser_notifications_enabled = False
        db.commit()
        assert dispatch(db, settings, now=now+timedelta(days=1), sender=send) == 0


def test_dispatch_retries_network_errors_and_removes_expired_endpoints(env):
    client, engine, settings = env
    client.post('/api/v1/push/subscriptions', json=subscription())
    now = datetime.now(UTC).replace(hour=12)
    with Session(engine) as db:
        db.get(User, 1).browser_notifications_enabled = True
        db.commit()
        assert dispatch(db, settings, now=now, sender=lambda *_: 'retry') == 0
        assert db.scalar(select(PushSubscription)).sent == {}
        assert dispatch(db, settings, now=now, sender=lambda *_: 'sent') == 1
        assert dispatch(db, settings, now=now+timedelta(days=1), sender=lambda *_: 'expired') == 0
        assert not db.scalars(select(PushSubscription)).all()


def test_dispatch_respects_family_setting_quiet_hours_and_session_expiry(env):
    client, engine, settings = env
    client.post('/api/v1/push/subscriptions', json=subscription())
    morning = datetime.now(UTC).replace(hour=3)
    with Session(engine) as db:
        user = db.get(User, 1)
        user.browser_notifications_enabled = True
        sub = db.scalar(select(PushSubscription))
        session = db.get(UserSession, sub.session_id)
        session.expires_at = morning + timedelta(days=1)
        db.commit()
        def forbidden(*_):
            pytest.fail('Unexpected notification')
        assert dispatch(db, settings, now=morning, sender=forbidden) == 0
        session.active_family.plan_reminders_enabled = False
        db.commit()
        assert dispatch(db, settings, now=morning+timedelta(hours=10), sender=forbidden) == 0
        session.expires_at = morning - timedelta(seconds=1)
        db.commit()
        assert dispatch(db, settings, now=morning, sender=forbidden) == 0
        assert not db.scalars(select(PushSubscription)).all()


def test_transport_encrypts_payload_signs_vapid_and_disables_redirects(env, monkeypatch):
    import requests
    client, engine, settings = env
    key = ec.generate_private_key(ec.SECP256R1())
    private = key.private_numbers().private_value.to_bytes(32, 'big')
    settings.push_vapid_private_key = SecretStr(base64.urlsafe_b64encode(private).decode().rstrip('='))
    client.post('/api/v1/push/subscriptions', json=subscription())
    captured = {}
    def request(self, method, url, **kwargs):
        captured.update(kwargs)
        result = requests.Response()
        result.status_code = 201
        result._content = b''
        return result
    monkeypatch.setattr(requests.Session, 'request', request)
    with Session(engine) as db:
        assert send_push(db.scalar(select(PushSubscription)), {'title': 'Secret notification title'}, settings) == 'sent'
    assert b'Secret notification title' not in captured['data']
    assert captured['headers']['content-encoding'] == 'aes128gcm'
    assert captured['headers']['authorization'].startswith('vapid ')
    assert captured['allow_redirects'] is False
    assert captured['timeout'] == 10
