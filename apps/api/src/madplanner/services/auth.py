import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, joinedload
from cryptography.fernet import Fernet
import pyotp

from madplanner.models import Family, FamilyInvitation, FamilyMembership, FamilyRole, MealPlanEntry, MfaLoginChallenge, Recipe, RecipeType, SecurityEvent, User, UserSession


DEFAULT_RECIPE_TYPES = (
    ("Breakfast", "breakfast"), ("Lunch", "lunch"), ("Dinner", "dinner"),
    ("Bake-off", None), ("Cake", None), ("Dessert", None), ("Bread", None), ("Snack", None),
)


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


@dataclass(frozen=True)
class MfaChallenge:
    token: str


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
        self.session.add_all(
            [RecipeType(family_id=family.id, name=name, normalized_name=name.casefold(), meal_type=meal_type) for name, meal_type in DEFAULT_RECIPE_TYPES]
        )
        self.session.execute(update(Recipe).where(Recipe.family_id.is_(None)).values(family_id=family.id))
        self.session.execute(update(MealPlanEntry).where(MealPlanEntry.family_id.is_(None)).values(family_id=family.id))
        auth_context, token = self._create_session(user, family, FamilyRole.OWNER)
        self.session.commit()
        return auth_context, token

    def login(self, email: str, password: str) -> tuple[AuthContext, str] | MfaChallenge | None:
        user = self.session.scalar(
            select(User)
            .options(joinedload(User.memberships).joinedload(FamilyMembership.family))
            .where(User.normalized_email == normalize_email(email))
        )
        if user is None or not user.memberships:
            return None
        membership = user.memberships[0]
        if not verify_password(password, user.password_hash):
            self.session.add(SecurityEvent(family_id=membership.family_id, user_id=user.id, event_type="login_failed"))
            self.session.commit()
            return None
        if user.mfa_enabled:
            token = secrets.token_urlsafe(32)
            self.session.add(MfaLoginChallenge(user_id=user.id, family_id=membership.family_id, token_hash=hash_token(token), expires_at=utc_now() + timedelta(minutes=5)))
            self.session.commit()
            return MfaChallenge(token)
        auth_context, token = self._create_session(user, membership.family, membership.role)
        self.session.add(SecurityEvent(family_id=membership.family_id, user_id=user.id, event_type="login_succeeded"))
        self.session.commit()
        return auth_context, token

    def complete_mfa_login(self, challenge_token: str, code: str, encryption_key: str) -> tuple[AuthContext, str] | None:
        challenge = self.session.scalar(select(MfaLoginChallenge).options(joinedload(MfaLoginChallenge.user), joinedload(MfaLoginChallenge.family)).where(MfaLoginChallenge.token_hash == hash_token(challenge_token)))
        if challenge is None or is_expired(challenge.expires_at) or challenge.attempts >= 5:
            if challenge is not None:
                self.session.delete(challenge); self.session.commit()
            return None
        membership = self.session.scalar(select(FamilyMembership).where(FamilyMembership.user_id == challenge.user_id, FamilyMembership.family_id == challenge.family_id))
        user = challenge.user
        normalized_code = code.strip().replace("-", "").upper()
        valid = False
        if user.mfa_secret_encrypted and normalized_code.isdigit():
            secret = Fernet(encryption_key).decrypt(user.mfa_secret_encrypted.encode()).decode()
            valid = pyotp.TOTP(secret).verify(normalized_code, valid_window=1)
        if not valid:
            recovery_hash = hash_token(normalized_code)
            valid = any(hmac.compare_digest(recovery_hash, stored) for stored in user.mfa_recovery_code_hashes)
            if valid:
                user.mfa_recovery_code_hashes = [stored for stored in user.mfa_recovery_code_hashes if not hmac.compare_digest(recovery_hash, stored)]
        if not valid or membership is None:
            challenge.attempts += 1; self.session.commit(); return None
        self.session.delete(challenge)
        context, token = self._create_session(user, challenge.family, membership.role)
        self.session.add(SecurityEvent(family_id=challenge.family_id, user_id=user.id, event_type="login_succeeded"))
        self.session.commit()
        return context, token

    def list_security_events(self, family_id: int, limit: int = 100) -> list[SecurityEvent]:
        return list(self.session.scalars(select(SecurityEvent).options(joinedload(SecurityEvent.user)).where(SecurityEvent.family_id == family_id).order_by(SecurityEvent.created_at.desc(), SecurityEvent.id.desc()).limit(limit)))

    def start_mfa_enrollment(self, context: AuthContext, encryption_key: str) -> tuple[str, str]:
        secret = pyotp.random_base32()
        context.user.mfa_secret_encrypted = Fernet(encryption_key).encrypt(secret.encode()).decode()
        context.user.mfa_enabled = False
        context.user.mfa_recovery_code_hashes = []
        self.session.commit()
        return secret, pyotp.TOTP(secret).provisioning_uri(name=context.user.email, issuer_name="Mad Planner")

    def confirm_mfa_enrollment(self, context: AuthContext, code: str, encryption_key: str) -> list[str] | None:
        if not context.user.mfa_secret_encrypted:
            return None
        secret = Fernet(encryption_key).decrypt(context.user.mfa_secret_encrypted.encode()).decode()
        if not pyotp.TOTP(secret).verify(code.strip(), valid_window=1):
            return None
        recovery_codes = [secrets.token_hex(5).upper() for _ in range(10)]
        context.user.mfa_recovery_code_hashes = [hash_token(code) for code in recovery_codes]
        context.user.mfa_enabled = True
        self.session.add(SecurityEvent(family_id=context.family.id, user_id=context.user.id, event_type="mfa_enabled"))
        self.session.commit()
        return recovery_codes

    def disable_mfa(self, context: AuthContext, password: str) -> bool:
        if not verify_password(password, context.user.password_hash):
            return False
        context.user.mfa_enabled = False
        context.user.mfa_secret_encrypted = None
        context.user.mfa_recovery_code_hashes = []
        self.session.add(SecurityEvent(family_id=context.family.id, user_id=context.user.id, event_type="mfa_disabled"))
        self.session.commit()
        return True

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

    def update_personal_locale(self, user: User, locale: str) -> User:
        user.locale = locale
        self.session.add(user)
        self.session.commit()
        return user

    def count_sessions(self, user_id: int, family_id: int) -> int:
        return self.session.scalar(
            select(func.count(UserSession.id)).where(
                UserSession.user_id == user_id,
                UserSession.active_family_id == family_id,
                UserSession.expires_at > utc_now(),
            )
        ) or 0

    def update_family_settings(
        self,
        family: Family,
        *,
        household_size: int,
        leftovers_enabled: bool,
        cooking_mode_enabled: bool,
        enabled_meal_types: list[str],
    ) -> Family:
        family.household_size = household_size
        family.leftovers_enabled = leftovers_enabled
        family.cooking_mode_enabled = cooking_mode_enabled
        family.enabled_meal_types = list(dict.fromkeys(enabled_meal_types))
        self.session.add(family)
        self.session.commit()
        return family

    def list_recipe_types(self, family_id: int) -> list[RecipeType]:
        return list(self.session.scalars(select(RecipeType).where(RecipeType.family_id == family_id).order_by(RecipeType.name)))

    def create_recipe_type(self, family_id: int, name: str, meal_type: str | None) -> RecipeType:
        cleaned = " ".join(name.split())
        normalized = cleaned.casefold()
        existing = self.session.scalar(
            select(RecipeType).where(RecipeType.family_id == family_id, RecipeType.normalized_name == normalized)
        )
        if existing is not None:
            raise ValueError("type_exists")
        recipe_type = RecipeType(family_id=family_id, name=cleaned, normalized_name=normalized, meal_type=meal_type)
        self.session.add(recipe_type)
        self.session.commit()
        return recipe_type

    def delete_recipe_type(self, family_id: int, recipe_type_id: int) -> bool:
        recipe_type = self.session.scalar(
            select(RecipeType).where(RecipeType.id == recipe_type_id, RecipeType.family_id == family_id)
        )
        if recipe_type is None:
            return False
        if recipe_type.recipes:
            raise ValueError("type_in_use")
        self.session.delete(recipe_type)
        self.session.commit()
        return True

    def list_pending_invitations(self, family_id: int) -> list[FamilyInvitation]:
        return list(
            self.session.scalars(
                select(FamilyInvitation)
                .where(
                    FamilyInvitation.family_id == family_id,
                    FamilyInvitation.accepted_at.is_(None),
                    FamilyInvitation.expires_at > utc_now(),
                )
                .order_by(FamilyInvitation.created_at.desc())
            )
        )

    def revoke_invitation(self, family_id: int, invitation_id: int) -> bool:
        invitation = self.session.scalar(
            select(FamilyInvitation).where(
                FamilyInvitation.id == invitation_id,
                FamilyInvitation.family_id == family_id,
                FamilyInvitation.accepted_at.is_(None),
            )
        )
        if invitation is None:
            return False
        self.session.delete(invitation)
        self.session.commit()
        return True

    def revoke_member_sessions(self, family_id: int, user_id: int) -> bool:
        membership = self.session.scalar(
            select(FamilyMembership).where(
                FamilyMembership.family_id == family_id,
                FamilyMembership.user_id == user_id,
                FamilyMembership.role != FamilyRole.OWNER,
            )
        )
        if membership is None:
            return False
        self.session.execute(
            delete(UserSession).where(
                UserSession.user_id == user_id,
                UserSession.active_family_id == family_id,
            )
        )
        self.session.commit()
        return True

    def remove_member(self, family_id: int, user_id: int) -> bool:
        membership = self.session.scalar(
            select(FamilyMembership).where(
                FamilyMembership.family_id == family_id,
                FamilyMembership.user_id == user_id,
                FamilyMembership.role != FamilyRole.OWNER,
            )
        )
        if membership is None:
            return False
        user = membership.user
        self.session.delete(membership)
        self.session.flush()
        remaining_memberships = self.session.scalar(
            select(func.count(FamilyMembership.id)).where(FamilyMembership.user_id == user_id)
        ) or 0
        if remaining_memberships == 0:
            self.session.delete(user)
        self.session.commit()
        return True

    def update_member_role(self, family_id: int, user_id: int, role: FamilyRole) -> FamilyMembership | None:
        membership = self.session.scalar(
            select(FamilyMembership).where(
                FamilyMembership.family_id == family_id,
                FamilyMembership.user_id == user_id,
                FamilyMembership.role != FamilyRole.OWNER,
            )
        )
        if membership is None:
            return None
        membership.role = role
        self.session.add(membership)
        self.session.commit()
        return membership

    def create_invitation(self, context: AuthContext, email: str, role: FamilyRole) -> tuple[FamilyInvitation, str]:
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
            role=role,
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
