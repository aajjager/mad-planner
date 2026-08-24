"""Replace the legacy member role with permission presets."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260824_09"
down_revision: str | None = "20260824_08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("family_memberships", "role", existing_type=sa.String(length=6), type_=sa.String(length=20), existing_nullable=False)
    op.alter_column("family_invitations", "role", existing_type=sa.String(length=6), type_=sa.String(length=20), existing_nullable=False)
    op.execute("UPDATE family_memberships SET role = 'editor' WHERE role = 'member'")
    op.execute("UPDATE family_invitations SET role = 'editor' WHERE role = 'member'")


def downgrade() -> None:
    op.execute("UPDATE family_memberships SET role = 'member' WHERE role IN ('editor', 'planner', 'viewer')")
    op.execute("UPDATE family_invitations SET role = 'member' WHERE role IN ('editor', 'planner', 'viewer')")
    op.alter_column("family_invitations", "role", existing_type=sa.String(length=20), type_=sa.String(length=6), existing_nullable=False)
    op.alter_column("family_memberships", "role", existing_type=sa.String(length=20), type_=sa.String(length=6), existing_nullable=False)
