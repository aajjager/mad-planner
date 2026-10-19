"""Administrator approval boundary and scoped, leased worker protocol."""
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from madplanner.api.routes.auth import require_system_admin
from madplanner.core.config import get_settings
from madplanner.db.session import get_session
from madplanner.models import FeedbackSubmission, ImplementationJob
from madplanner.services.auth import AuthContext

router = APIRouter(prefix="/implementations", tags=["implementations"])
Db = Annotated[Session, Depends(get_session)]
Admin = Annotated[AuthContext, Depends(require_system_admin)]
RUNNING = ("implementing", "testing", "deploying", "merging")
ACTIVE = (*RUNNING, "queued", "ready", "approved")


def now():
    return datetime.now(UTC)


def configured():
    settings = get_settings()
    token = settings.implementation_worker_token.get_secret_value() if settings.implementation_worker_token else ""
    preview = urlsplit(settings.implementation_preview_url or "")
    return len(token) >= 32 and preview.scheme in ("http", "https") and bool(preview.hostname) and not preview.username


def public(job):
    return {key: getattr(job, key) for key in ("id", "feedback_id", "category", "request_text", "revision", "status", "details", "created_at", "updated_at")}


def expire(db):
    for job in db.scalars(select(ImplementationJob).where(ImplementationJob.status.in_(RUNNING), ImplementationJob.lease_until < now()).with_for_update()):
        job.status = "failed"
        job.claim_hash = None
        job.details = {**job.details, "summary": "Worker lease expired. Review the pull request and branch before retrying."}
    db.commit()


def locked_job(db, job_id):
    job = db.scalar(select(ImplementationJob).where(ImplementationJob.id == job_id).with_for_update())
    if not job:
        raise HTTPException(404, "Implementation job not found")
    return job


@router.get("")
def jobs(db: Db, _: Admin):
    expire(db)
    return {"enabled": configured(), "jobs": [public(job) for job in db.scalars(select(ImplementationJob).order_by(ImplementationJob.id.desc()).limit(100))]}


@router.post("/feedback/{feedback_id}", status_code=201)
def enqueue(feedback_id: int, db: Db, context: Admin):
    if not configured():
        raise HTTPException(503, "Implementation worker and preview address are not configured")
    feedback = db.scalar(select(FeedbackSubmission).where(FeedbackSubmission.id == feedback_id).with_for_update())
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    if feedback.status != "approved" or feedback.is_question:
        raise HTTPException(409, "Only approved implementation requests can be queued")
    if db.scalar(select(ImplementationJob.id).where(ImplementationJob.feedback_id == feedback_id, ImplementationJob.status.in_(ACTIVE))):
        raise HTTPException(409, "This request already has an active implementation")
    job = ImplementationJob(feedback_id=feedback.id, requested_by=context.user.id, category=feedback.category, request_text=feedback.content, details={})
    db.add(job)
    db.commit()
    db.refresh(job)
    return public(job)


class Decision(BaseModel):
    revision: int
    head_sha: str = Field(pattern=r"^[0-9a-f]{40}$")


@router.post("/{job_id}/approve")
def approve(job_id: int, data: Decision, db: Db, context: Admin):
    job = locked_job(db, job_id)
    if job.status != "ready" or job.revision != data.revision or job.details.get("head_sha") != data.head_sha:
        raise HTTPException(409, "The preview has changed or is not ready; review it again")
    feedback = db.get(FeedbackSubmission, job.feedback_id) if job.feedback_id else None
    if not feedback or feedback.status != "approved" or feedback.is_question:
        raise HTTPException(409, "The original request is no longer approved for implementation")
    job.status = "approved"
    job.details = {**job.details, "approved_sha": data.head_sha, "approved_by": context.user.id}
    db.commit()
    return public(job)


class RevisionRequest(BaseModel):
    revision: int
    message: str = Field(min_length=1, max_length=4000)


@router.post("/{job_id}/changes")
def changes(job_id: int, data: RevisionRequest, db: Db, _: Admin):
    job = locked_job(db, job_id)
    if job.status not in ("ready", "failed") or job.revision != data.revision or not data.message.strip():
        raise HTTPException(409, "Only the current reviewable or failed revision can be revised")
    feedback = db.scalar(select(FeedbackSubmission).where(FeedbackSubmission.id == job.feedback_id).with_for_update()) if job.feedback_id else None
    if not feedback or feedback.status != "approved" or feedback.is_question:
        raise HTTPException(409, "The original request is no longer approved")
    if db.scalar(select(ImplementationJob.id).where(ImplementationJob.feedback_id == job.feedback_id, ImplementationJob.id != job.id, ImplementationJob.status.in_(ACTIVE))):
        raise HTTPException(409, "This request already has another active implementation")
    history = [*job.details.get("history", []), {"revision": job.revision, "status": job.status, "head_sha": job.details.get("head_sha"), "summary": job.details.get("summary"), "message": data.message.strip()}]
    job.details = {"history": history[-20:], "parent_head": job.details.get("head_sha") or job.details.get("parent_head"), "review_feedback": data.message.strip()}
    job.revision += 1
    job.status = "queued"
    job.claim_hash = None
    db.commit()
    return public(job)


@router.post("/{job_id}/cancel")
def cancel(job_id: int, db: Db, _: Admin):
    job = locked_job(db, job_id)
    if job.status == "merging" or job.status == "merged":
        raise HTTPException(409, "A merge already started; cancellation is no longer available")
    job.status = "cancelled"
    job.claim_hash = None
    db.commit()
    return public(job)


def require_worker(authorization: Annotated[str | None, Header()] = None):
    configured_token = get_settings().implementation_worker_token
    expected = configured_token.get_secret_value() if configured_token else ""
    if not expected or not hmac.compare_digest(authorization or "", f"Bearer {expected}"):
        raise HTTPException(401, "Worker authentication required")


Worker = Annotated[None, Depends(require_worker)]


@router.post("/worker/claim")
def claim(db: Db, _: Worker):
    expire(db)
    # Serialize the global queue on PostgreSQL. SQLite tests run sequentially.
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy import text
        db.execute(text("SELECT pg_advisory_xact_lock(74839201)"))
    if db.scalar(select(ImplementationJob.id).where(ImplementationJob.status.in_(RUNNING))):
        return None
    job = db.scalar(select(ImplementationJob).where(ImplementationJob.status == "approved").order_by(ImplementationJob.id).with_for_update())
    action = "merge"
    if not job:
        if db.scalar(select(ImplementationJob.id).where(ImplementationJob.status == "ready")):
            return None  # Keep the reviewed preview available until the decision.
        job = db.scalar(select(ImplementationJob).where(ImplementationJob.status == "queued").order_by(ImplementationJob.id).with_for_update())
        action = "implement"
    if not job:
        return None
    feedback = db.get(FeedbackSubmission, job.feedback_id) if job.feedback_id else None
    if not feedback or feedback.status != "approved" or feedback.is_question:
        job.status = "cancelled"
        db.commit()
        return None
    token = secrets.token_urlsafe(32)
    job.status = "merging" if action == "merge" else "implementing"
    job.claim_hash = hashlib.sha256(token.encode()).hexdigest()
    job.lease_until = now() + timedelta(minutes=5)
    db.commit()
    return {**public(job), "claim_token": token, "action": action, "preview_url": get_settings().implementation_preview_url}


class Report(BaseModel):
    claim_token: str
    revision: int
    status: Literal["heartbeat", "testing", "deploying", "ready", "merged", "failed"]
    summary: str = Field(default="", max_length=12000)
    head_sha: str | None = Field(default=None, pattern=r"^[0-9a-f]{40}$")
    base_sha: str | None = Field(default=None, pattern=r"^[0-9a-f]{40}$")
    branch: str | None = Field(default=None, pattern=r"^codex/[a-zA-Z0-9/_-]+$")
    pr_number: int | None = Field(default=None, gt=0)
    tests_passed: bool = False


@router.post("/worker/{job_id}/report")
def report(job_id: int, data: Report, db: Db, _: Worker):
    job = locked_job(db, job_id)
    expiry = job.lease_until.replace(tzinfo=UTC) if job.lease_until and job.lease_until.tzinfo is None else job.lease_until
    if job.status not in RUNNING or job.revision != data.revision or not job.claim_hash or not hmac.compare_digest(job.claim_hash, hashlib.sha256(data.claim_token.encode()).hexdigest()) or not expiry or expiry < now():
        raise HTTPException(409, "Worker lease is stale or the job was cancelled")
    allowed = {"implementing": ("testing", "failed"), "testing": ("deploying", "failed"), "deploying": ("ready", "failed"), "merging": ("merged", "failed")}
    if data.status != "heartbeat" and data.status not in allowed[job.status]:
        raise HTTPException(409, "Invalid implementation transition")
    if data.status == "ready" or (data.status == "deploying" and data.head_sha):
        if not all((data.head_sha, data.base_sha, data.branch, data.pr_number, data.tests_passed)):
            raise HTTPException(422, "A tested commit, base, branch, and pull request are required")
        preview = get_settings().implementation_preview_url or ""
        if urlsplit(preview).scheme not in ("http", "https") or not urlsplit(preview).netloc:
            raise HTTPException(503, "Preview address is not configured")
        job.details = {**job.details, "head_sha": data.head_sha, "base_sha": data.base_sha, "branch": data.branch, "pr_number": data.pr_number, "tests_passed": True, "preview_url": preview}
    if data.status == "merged" and data.head_sha != job.details.get("approved_sha"):
        raise HTTPException(409, "Merge must match the approved commit")
    if data.summary:
        job.details = {**job.details, "summary": data.summary}
    if data.status != "heartbeat":
        job.status = data.status
    job.lease_until = now() + timedelta(minutes=5)
    if job.status in ("ready", "merged", "failed"):
        job.claim_hash = None
    if job.status == "merged" and job.feedback_id:
        feedback = db.get(FeedbackSubmission, job.feedback_id)
        if feedback:
            feedback.status = "done"
            feedback.completed_at = now()
            feedback.completion_seen_at = None
    db.commit()
    return public(job)
