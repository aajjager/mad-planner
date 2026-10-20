from datetime import datetime, timedelta, UTC

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from madplanner.core.config import get_settings
from madplanner.db.base import Base
from madplanner.db.session import get_session
from madplanner.main import app
from madplanner.models import FeedbackSubmission, ImplementationJob


@pytest.fixture
def env(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_session] = session
    monkeypatch.setattr(get_settings(), 'implementation_worker_token', SecretStr('worker-test-secret-' + 'x' * 32))
    monkeypatch.setattr(get_settings(), 'implementation_preview_url', 'http://127.0.0.1:8090')
    client = TestClient(app)
    client.post('/api/v1/auth/setup', json={'email': 'owner@example.com', 'display_name': 'Owner', 'family_name': 'Test', 'password': 'long-password-123'})
    # Exercise real administrator and worker authentication; use DB only to seed feedback.
    with Session(engine) as db:
        item = FeedbackSubmission(family_id=1, user_id=1, content='Improve the planner', category='improvement', status='approved')
        db.add(item); db.commit()
    try:
        yield client, engine
    finally:
        app.dependency_overrides.clear()


HEAD = 'a' * 40
BASE = 'b' * 40
AUTH = {'Authorization': 'Bearer worker-test-secret-' + 'x' * 32}


def queued(client):
    result = client.post('/api/v1/implementations/feedback/1')
    assert result.status_code == 201
    return result.json()


def claim(client):
    return client.post('/api/v1/implementations/worker/claim', headers=AUTH).json()


def report(client, job, status, **kwargs):
    return client.post(f"/api/v1/implementations/worker/{job['id']}/report", headers=AUTH, json={'claim_token': job['claim_token'], 'revision': job['revision'], 'status': status, **kwargs})


def ready(client):
    queued(client); job = claim(client)
    assert report(client, job, 'testing').status_code == 200
    assert report(client, job, 'deploying').status_code == 200
    assert report(client, job, 'ready', head_sha=HEAD, base_sha=BASE, branch='codex/job-1', pr_number=3, tests_passed=True).status_code == 200
    return job


def test_queue_requires_admin_and_worker_credentials(env):
    client, engine = env
    assert TestClient(app).get('/api/v1/implementations').status_code == 401
    assert client.post('/api/v1/implementations/worker/claim').status_code == 401
    with Session(engine) as db:
        item = db.get(FeedbackSubmission, 1); item.is_question = True; db.commit()
    assert client.post('/api/v1/implementations/feedback/1').status_code == 409
    with Session(engine) as db:
        item = db.get(FeedbackSubmission, 1); item.is_question = False; db.commit()
    queued(client)
    assert client.post('/api/v1/implementations/feedback/1').status_code == 409
    job = claim(client)
    assert job['action'] == 'implement'
    assert claim(client) is None
    assert report(client, job, 'ready', head_sha=HEAD).status_code == 409
    exposed = client.get('/api/v1/implementations').json()['jobs'][0]
    assert 'claim_hash' not in exposed and 'claim_token' not in exposed


def test_exact_commit_approval_then_merge_completes_feedback(env):
    client, engine = env
    ready(client)
    assert claim(client) is None
    assert client.post('/api/v1/implementations/1/approve', json={'revision': 1, 'head_sha': BASE}).status_code == 409
    assert client.post('/api/v1/implementations/1/approve', json={'revision': 1, 'head_sha': HEAD}).status_code == 200
    job = claim(client)
    assert job['action'] == 'merge'
    assert client.post('/api/v1/implementations/1/cancel').status_code == 409
    assert report(client, job, 'merged', head_sha=BASE).status_code == 409
    assert report(client, job, 'merged', head_sha=HEAD).status_code == 200
    with Session(engine) as db:
        assert db.get(FeedbackSubmission, 1).status == 'done'


def test_revision_invalidates_old_worker_and_approval_and_preserves_history(env):
    client, _ = env
    old = ready(client)
    assert client.post('/api/v1/implementations/1/changes', json={'revision': 1, 'message': 'Use a smaller button'}).status_code == 200
    assert report(client, old, 'testing').status_code == 409
    assert client.post('/api/v1/implementations/1/approve', json={'revision': 1, 'head_sha': HEAD}).status_code == 409
    job = claim(client)
    assert job['revision'] == 2
    assert job['details']['history'][0]['head_sha'] == HEAD
    assert job['details']['parent_head'] == HEAD
    assert 'approved_sha' not in job['details']
    assert client.post('/api/v1/implementations/1/cancel').status_code == 200
    assert report(client, job, 'heartbeat').status_code == 409


def test_dead_worker_fails_and_does_not_reexecute_without_admin(env):
    client, engine = env
    queued(client); old = claim(client)
    with Session(engine) as db:
        job = db.get(ImplementationJob, 1); job.lease_until = datetime.now(UTC) - timedelta(seconds=1); db.commit()
    assert claim(client) is None
    assert client.get('/api/v1/implementations').json()['jobs'][0]['status'] == 'failed'
    assert report(client, old, 'heartbeat').status_code == 409


def test_withdrawn_request_cannot_be_implemented_or_approved(env):
    client, engine = env
    ready(client)
    with Session(engine) as db:
        feedback = db.get(FeedbackSubmission, 1); feedback.is_question = True; db.commit()
    assert client.post('/api/v1/implementations/1/approve', json={'revision': 1, 'head_sha': HEAD}).status_code == 409
    assert client.post('/api/v1/implementations/1/changes', json={'revision': 1, 'message': 'Do it anyway'}).status_code == 409


def test_failed_job_cannot_be_requeued_twice_through_different_controls(env):
    client, _ = env
    queued(client); job = claim(client)
    assert report(client, job, 'failed', summary='Test failed').status_code == 200
    queued(client)
    assert client.post('/api/v1/implementations/1/changes', json={'revision': 1, 'message': 'Retry it'}).status_code == 409


def test_failed_preview_retains_reviewable_commit_and_pull_request(env):
    client, _ = env
    queued(client); job = claim(client)
    report(client, job, 'testing')
    assert report(client, job, 'deploying', head_sha=HEAD, base_sha=BASE, branch='codex/job-1', pr_number=8, tests_passed=True).status_code == 200
    assert report(client, job, 'failed', summary='Preview did not start').status_code == 200
    details = client.get('/api/v1/implementations').json()['jobs'][0]['details']
    assert details['head_sha'] == HEAD and details['pr_number'] == 8
