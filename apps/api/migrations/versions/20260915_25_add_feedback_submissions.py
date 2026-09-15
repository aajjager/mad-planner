"""Add user feedback submissions.

Revision ID: 20260915_25
Revises: 20260913_24
"""

from alembic import op
import sqlalchemy as sa

revision = "20260915_25"
down_revision = "20260913_24"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback_submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(length=4000), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_feedback_submissions_family_id"), "feedback_submissions", ["family_id"])
    op.create_index(op.f("ix_feedback_submissions_user_id"), "feedback_submissions", ["user_id"])
    op.create_index(op.f("ix_feedback_submissions_status"), "feedback_submissions", ["status"])
    op.create_index(op.f("ix_feedback_submissions_reviewed_by_user_id"), "feedback_submissions", ["reviewed_by_user_id"])
    op.create_index(op.f("ix_feedback_submissions_created_at"), "feedback_submissions", ["created_at"])


def downgrade() -> None:
    op.drop_table("feedback_submissions")
