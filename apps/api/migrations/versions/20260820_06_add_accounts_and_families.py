"""Add accounts, families, invitations, and sessions."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260820_06"
down_revision: str | None = "20260820_05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "families",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_families")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("normalized_email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_normalized_email"), "users", ["normalized_email"], unique=True)
    op.create_table(
        "family_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=6), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], name=op.f("fk_family_memberships_family_id_families"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_family_memberships_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_family_memberships")),
        sa.UniqueConstraint("family_id", "user_id", name="uq_family_memberships_family_user"),
    )
    op.create_index(op.f("ix_family_memberships_family_id"), "family_memberships", ["family_id"], unique=False)
    op.create_index(op.f("ix_family_memberships_user_id"), "family_memberships", ["user_id"], unique=False)
    op.create_table(
        "family_invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("intended_email", sa.String(length=320), nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=6), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], name=op.f("fk_family_invitations_created_by_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], name=op.f("fk_family_invitations_family_id_families"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_family_invitations")),
    )
    op.create_index(op.f("ix_family_invitations_created_by_user_id"), "family_invitations", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_family_invitations_family_id"), "family_invitations", ["family_id"], unique=False)
    op.create_index(op.f("ix_family_invitations_token_hash"), "family_invitations", ["token_hash"], unique=True)
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("active_family_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["active_family_id"], ["families.id"], name=op.f("fk_user_sessions_active_family_id_families"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_sessions_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_sessions")),
    )
    op.create_index(op.f("ix_user_sessions_active_family_id"), "user_sessions", ["active_family_id"], unique=False)
    op.create_index(op.f("ix_user_sessions_expires_at"), "user_sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_user_sessions_token_hash"), "user_sessions", ["token_hash"], unique=True)
    op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("user_sessions")
    op.drop_table("family_invitations")
    op.drop_table("family_memberships")
    op.drop_index(op.f("ix_users_normalized_email"), table_name="users")
    op.drop_table("users")
    op.drop_table("families")
