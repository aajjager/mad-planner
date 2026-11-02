"""Opt-in Web Push delivery. No credentials or endpoint URLs belong in logs."""
import base64
from datetime import UTC, datetime, timedelta
import json
import logging
from importlib.resources import files
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy import select, text

from madplanner.models import FamilyMembership, UserSession
from madplanner.models.push import PushSubscription
from madplanner.repositories.planner import MealPlanRepository
from madplanner.services.planner import MealPlanService

log = logging.getLogger(__name__)


def configured(settings):
    return bool(settings.push_enabled and settings.push_vapid_private_key and settings.push_vapid_public_key
                and settings.push_vapid_subject and settings.push_vapid_subject.startswith(("mailto:", "https://")))


def validate_endpoint(value):
    url = urlsplit(value)
    # Only established browser push providers may receive server-side requests.
    # Arbitrary URLs, LAN destinations and redirects must never be followed.
    host = (url.hostname or "").lower()
    allowed = host in ("fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com") or host.endswith(".notify.windows.com")
    if not allowed or url.scheme != "https" or url.port not in (None, 443) or url.username or url.password or url.fragment:
        raise ValueError("Unsupported browser push endpoint")


def validate_keys(p256dh, auth):
    def decode(value):
        return base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
    public = decode(p256dh)
    if len(public) != 65 or len(decode(auth)) != 16:
        raise ValueError("Invalid push encryption keys")
    ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public)


def aware(value):
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def send_push(subscription, payload, settings):
    import requests
    from pywebpush import webpush, WebPushException

    class NoRedirectSession(requests.Session):
        def request(self, *args, **kwargs):
            kwargs['allow_redirects'] = False
            return super().request(*args, **kwargs)

    validate_endpoint(subscription.endpoint)
    try:
        with NoRedirectSession() as transport:
            response = webpush(
                subscription_info={"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                data=json.dumps(payload), vapid_private_key=settings.push_vapid_private_key.get_secret_value(),
                vapid_claims={"sub": settings.push_vapid_subject}, ttl=3600, timeout=10, requests_session=transport)
        return 'sent' if 200 <= response.status_code < 300 else 'retry'
    except WebPushException as error:
        return 'expired' if error.response is not None and error.response.status_code in (404, 410) else 'retry'


MESSAGES = {
    'en': ('Your upcoming meal plan needs attention', 'Open Mad Planner to finish planning.', 'This week’s Mad Planner updates', 'Open Updates to see the new patch notes.'),
    'da': ('Din kommende madplan mangler måltider', 'Åbn Mad Planner for at færdiggøre planen.', 'Ugens Mad Planner-opdateringer', 'Åbn Opdateringer for at se de nye udgivelsesnoter.'),
    'nl': ('Je komende maaltijdplan heeft aandacht nodig', 'Open Mad Planner om je planning af te maken.', 'De Mad Planner-updates van deze week', 'Open Updates voor de nieuwe versienotities.'),
}


def weekly_release(now):
    local = now.astimezone(ZoneInfo('Europe/Copenhagen'))
    expected = f'{local.year - 2026}.{local.month}.{min(4, (local.day - 1) // 7 + 1)}'
    try:
        release = json.loads(files('madplanner').joinpath('release-notes.json').read_text())
    except (OSError, ValueError):
        return None
    return expected if release.get('version') == expected and release.get('has_changes') is True else None


def dispatch(db, settings, now=None, sender=send_push):
    if not configured(settings):
        return 0
    now = now or datetime.now(UTC)
    if db.bind.dialect.name == 'postgresql' and not db.scalar(text('SELECT pg_try_advisory_xact_lock(724113082)')):
        return 0
    sent_count = 0
    local = now.astimezone(ZoneInfo('Europe/Copenhagen'))
    for sub in db.scalars(select(PushSubscription).order_by(PushSubscription.id)).all():
        session = db.get(UserSession, sub.session_id)
        if not session or aware(session.expires_at) <= now:
            db.delete(sub)
            continue
        user, family = session.user, session.active_family
        membership = db.scalar(select(FamilyMembership.id).where(FamilyMembership.user_id == user.id, FamilyMembership.family_id == family.id))
        if not membership:
            db.delete(sub)
            continue
        if not user.browser_notifications_enabled:
            continue
        messages = MESSAGES.get(user.locale, MESSAGES['en'])
        events = []
        # One reminder per day and device, after 09:00 Copenhagen time.
        if local.hour >= 9 and family.plan_reminders_enabled:
            reminders = MealPlanService(MealPlanRepository(db, family.id), family.household_size).reminders(local.date(), True, family.plan_reminder_weeks, family.enabled_meal_types)
            if reminders.weeks:
                week = reminders.weeks[0].week_start.isoformat()
                events.append((f'plan:{local.date()}:{family.id}', {'title': messages[0], 'body': messages[1], 'url': f'/planner?week={week}', 'tag': 'madplanner-incomplete-plan'}))
        release = weekly_release(now)
        if release and local.hour >= 9:
            events.append((f'release:{release}', {'title': messages[2], 'body': messages[3], 'url': '/updates', 'tag': f'madplanner-release-{release}'}))
        # A calendar release week can exceed seven days at month-end.
        remembered = {key: value for key, value in (sub.sent or {}).items() if key == f'release:{release}' or value > (now - timedelta(days=7)).isoformat()}
        for key, payload in events:
            if key in remembered:
                continue
            try:
                outcome = sender(sub, payload, settings)
            except Exception:
                log.warning('Background push delivery failed; will retry')
                break
            if outcome == 'expired':
                db.delete(sub)
                break
            if outcome != 'sent':
                break
            remembered[key] = now.isoformat()
            sub.sent = dict(remembered)
            sent_count += 1
    db.commit()
    return sent_count


def run_dispatcher(stop, settings):
    from madplanner.db.session import SessionLocal
    while not stop.wait(60):
        try:
            with SessionLocal() as db:
                dispatch(db, settings)
        except Exception:
            log.warning('Background push scheduler failed; will retry')
