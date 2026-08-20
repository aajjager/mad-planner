import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from madplanner.models import Family, FamilyInvitation, FamilyMembership, FamilyRole, MealPlanEntry, Recipe, User, UserSession


def normalize_email(email: str) -> str:
    return email.strip().casefold()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return "scrypt$16384$8$1${}${}".format(
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(derived).decode(),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, n, r, p, salt_text, expected_text = stored_hash.split("$")
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected = base64.urlsafe_b64decode(expected_text)
        actual = hashlib.scrypt(
            password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def utc_now() -> datetime:
    return datetime.now(UTC)


def is_expired(value: datetime) -> bool:
    comparable = value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    return comparable <= utc_now()


@dataclass(frozen=True)
class AuthContext:
    user: User
    family: Family
    role: FamilyRole
    session: UserSession


class AuthService:
    def __init__(self, session: Session):
        self.session = session

    def setup_required(self) -> bool:
        return self.session.scalar(select(User.id).limit(1)) is None

    def create_owner(self, *, email: str, display_name: str, password: str, family_name: str) -> tuple[AuthContext, str]:
        if not self.setup_required():
            raise ValueError("setup_complete")
        user = User(
            email=email.strip(),
            normalized_email=normalize_email(email),
            display_name=display_name.strip(),
            password_hash=hash_password(password),
        )
        family = Family(name=family_name.strip())
        membership = FamilyMembership(user=user, family=family, role=FamilyRole.OWNER)
        self.session.add_all([user, family, membership])
        self.session.flush()
        self.session.execute(update(Recipe).where(Recipe.family_id.is_(None)).values(family_id=family.id))
        self.session.execute(update(MealPlanEntry).where(MealPlanEntry.family_id.is_(None)).values(family_id=family.id))
        auth_context, token = self._create_session(user, family, FamilyRole.OWNER)
        self.session.commit()
        return auth_context, token

    def login(self, email: str, password: str) -> tuple[AuthContext, str] | None:
        user = self.session.scalar(
            select(User)
            .options(joinedload(User.memberships).joinedload(FamilyMembership.family))
            .where(User.normalized_email == normalize_email(email))
        )
        if user is None or not verify_password(password, user.password_hash) or not user.memberships:
            return None
        membership = user.memberships[0]
        auth_context, token = self._create_session(user, membership.family, membership.role)
        self.session.commit()
        return auth_context, token

    def authenticate(self, token: str | None) -> AuthContext | None:
        if not token:
            return None
        user_session = self.session.scalar(
            select(UserSession)
            .options(joinedload(UserSession.user), joinedload(UserSession.active_family))
            .where(UserSession.token_hash == hash_token(token))
        )
        if user_session is None or is_expired(user_session.expires_at):
            if user_session is not None:
                self.session.delete(user_session)
                self.session.commit()
            return None
        membership = self.session.scalar(
            select(FamilyMembership).where(
                FamilyMembership.user_id == user_session.user_id,
                FamilyMembership.family_id == user_session.active_family_id,
            )
        )
        if membership is None:
            return None
        user_session.last_seen_at = utc_now()
        self.session.commit()
        return AuthContext(user_session.user, user_session.active_family, membership.role, user_session)

    def logout(self, token: str | None) -> None:
        if token:
            user_session = self.session.scalar(
                select(UserSession).where(UserSession.token_hash == hash_token(token))
            )
            if user_session is not None:
                self.session.delete(user_session)
                self.session.commit()

    def list_members(self, family_id: int) -> list[FamilyMembership]:
        return list(
            self.session.scalars(
                select(FamilyMembership)
                .options(joinedload(FamilyMembership.user))
                .where(FamilyMembership.family_id == family_id)
                .order_by(FamilyMembership.joined_at, FamilyMembership.id)
            )
        )

    def create_invitation(self, context: AuthContext, email: str) -> tuple[FamilyInvitation, str]:
        normalized = normalize_email(email)
        existing = self.session.scalar(select(User.id).where(User.normalized_email == normalized))
        if existing is not None:
            raise ValueError("account_exists")
        token = secrets.token_urlsafe(32)
        invitation = FamilyInvitation(
            family_id=context.family.id,
            created_by_user_id=context.user.id,
            intended_email=normalized,
            token_hash=hash_token(token),
            role=FamilyRole.MEMBER,
            expires_at=utc_now() + timedelta(days=7),
        )
        self.session.add(invitation)
        self.session.commit()
        return invitation, token

    def get_invitation(self, token: str) -> FamilyInvitation | None:
        invitation = self.session.scalar(
            select(FamilyInvitation)
            .options(joinedload(FamilyInvitation.family))
            .where(FamilyInvitation.token_hash == hash_token(token))
        )
        if invitation is None or invitation.accepted_at is not None or is_expired(invitation.expires_at):
            return None
        return invitation

    def accept_invitation(self, token: str, display_name: str, password: str) -> tuple[AuthContext, str] | None:
        invitation = self.get_invitation(token)
        if invitation is None or invitation.intended_email is None:
            return None
        if self.session.scalar(select(User.id).where(User.normalized_email == invitation.intended_email)):
            raise ValueError("account_exists")
        user = User(
            email=invitation.intended_email,
            normalized_email=invitation.intended_email,
            display_name=display_name.strip(),
            password_hash=hash_password(password),
        )
        membership = FamilyMembership(user=user, family_id=invitation.family_id, role=invitation.role)
        invitation.accepted_at = utc_now()
        self.session.add_all([user, membership])
        self.session.flush()
        context, session_token = self._create_session(user, invitation.family, invitation.role)
        self.session.commit()
        return context, session_token

    def _create_session(self, user: User, family: Family, role: FamilyRole) -> tuple[AuthContext, str]:
        token = secrets.token_urlsafe(32)
        user_session = UserSession(
            user=user,
            active_family=family,
            token_hash=hash_token(token),
            expires_at=utc_now() + timedelta(days=30),
        )
        self.session.add(user_session)
        self.session.flush()
        return AuthContext(user, family, role, user_session), token
