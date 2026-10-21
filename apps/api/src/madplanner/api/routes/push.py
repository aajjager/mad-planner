import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from madplanner.api.routes.auth import require_auth
from madplanner.core.config import get_settings
from madplanner.db.session import get_session
from madplanner.models import UserSession
from madplanner.models.push import PushSubscription
from madplanner.services.auth import AuthContext
from madplanner.services.push import configured, validate_endpoint, validate_keys

router = APIRouter(prefix='/push', tags=['notifications'])
Db = Annotated[Session, Depends(get_session)]
Auth = Annotated[AuthContext, Depends(require_auth)]


class Keys(BaseModel):
    p256dh: str = Field(min_length=80, max_length=100)
    auth: str = Field(min_length=20, max_length=30)


class Subscription(BaseModel):
    endpoint: str = Field(min_length=10, max_length=2048)
    keys: Keys


class Endpoint(BaseModel):
    endpoint: str = Field(max_length=2048)


@router.get('/config')
def config(_: Auth):
    settings = get_settings()
    enabled = configured(settings)
    return {'enabled': enabled, 'public_key': settings.push_vapid_public_key if enabled else None}


@router.post('/status')
def subscription_status(data: Endpoint, db: Db, context: Auth):
    row = db.scalar(select(PushSubscription).where(PushSubscription.endpoint_hash == hashlib.sha256(data.endpoint.encode()).hexdigest(), PushSubscription.session_id == context.session.id))
    return {'subscribed': row is not None}


@router.post('/subscriptions', status_code=201)
def subscribe(data: Subscription, db: Db, context: Auth):
    if not configured(get_settings()):
        raise HTTPException(503, 'Background push has not been configured by the administrator')
    try:
        validate_endpoint(data.endpoint)
        validate_keys(data.keys.p256dh, data.keys.auth)
    except ValueError:
        raise HTTPException(422, 'Unsupported browser endpoint or invalid subscription keys') from None
    digest = hashlib.sha256(data.endpoint.encode()).hexdigest()
    row = db.scalar(select(PushSubscription).where(PushSubscription.endpoint_hash == digest))
    if row and row.session_id != context.session.id and (row.p256dh != data.keys.p256dh or row.auth != data.keys.auth):
        raise HTTPException(409, 'This browser subscription is already registered')
    if not row:
        count = db.scalar(select(func.count()).select_from(PushSubscription).join(UserSession).where(UserSession.user_id == context.user.id))
        if count >= 20:
            raise HTTPException(409, 'Too many registered notification devices')
        row = PushSubscription(endpoint_hash=digest, endpoint=data.endpoint, session_id=context.session.id, p256dh=data.keys.p256dh, auth=data.keys.auth, sent={})
        db.add(row)
    elif row.session_id != context.session.id:
        # A new login on the same physical browser must not retain prior-user history.
        row.session_id = context.session.id
        row.sent = {}
    db.commit()
    return {'subscribed': True}


@router.delete('/subscriptions', status_code=204)
def unsubscribe(data: Endpoint, db: Db, context: Auth):
    row = db.scalar(select(PushSubscription).where(PushSubscription.endpoint_hash == hashlib.sha256(data.endpoint.encode()).hexdigest(), PushSubscription.session_id == context.session.id))
    if row:
        db.delete(row)
        db.commit()
