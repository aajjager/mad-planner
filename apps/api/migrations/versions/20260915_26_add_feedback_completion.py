"""Add feedback completion notifications.

Revision ID: 20260915_26
Revises: 20260915_25
"""

from alembic import op
import sqlalchemy as sa

revision = "20260915_26"
down_revision = "20260915_25"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feedback_submissions", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("feedback_submissions", sa.Column("completion_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("feedback_submissions", "completion_seen_at")
    op.drop_column("feedback_submissions", "completed_at")
