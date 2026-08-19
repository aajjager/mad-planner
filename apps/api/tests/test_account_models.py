from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from madplanner.db.base import Base
from madplanner.models import Family, FamilyInvitation, FamilyMembership, FamilyRole, User, UserSession


def test_family_membership_invitation_and_session_relationships() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    now = datetime.now(UTC)

    user = User(
        email="Owner@example.com",
        normalized_email="owner@example.com",
        display_name="Owner",
        password_hash="hashed-password",
    )
    family = Family(name="Our family")
    family.memberships.append(FamilyMembership(user=user, role=FamilyRole.OWNER))
    user.sessions.append(
        UserSession(
            active_family=family,
            token_hash="a" * 64,
            expires_at=now + timedelta(days=30),
        )
    )

    with Session(engine) as session:
        session.add_all([user, family])
        session.flush()
        session.add(
            FamilyInvitation(
                family_id=family.id,
                created_by_user_id=user.id,
                intended_email="member@example.com",
                token_hash="b" * 64,
                role=FamilyRole.MEMBER,
                expires_at=now + timedelta(days=7),
            )
        )
        session.commit()

        stored_user = session.scalar(select(User).where(User.normalized_email == "owner@example.com"))
        assert stored_user is not None
        assert stored_user.memberships[0].family.name == "Our family"
        assert stored_user.memberships[0].role is FamilyRole.OWNER
        assert stored_user.sessions[0].active_family_id == family.id
        assert session.scalar(select(FamilyInvitation)).intended_email == "member@example.com"
