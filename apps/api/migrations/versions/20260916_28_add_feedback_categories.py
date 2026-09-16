"""Add feedback categories.

Revision ID: 20260916_28
Revises: 20260915_27
"""

from alembic import op
import sqlalchemy as sa

revision = "20260916_28"
down_revision = "20260915_27"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feedback_submissions", sa.Column("category", sa.String(length=20), server_default="improvement", nullable=False))
    op.create_index("ix_feedback_submissions_category", "feedback_submissions", ["category"])


def downgrade() -> None:
    op.drop_index("ix_feedback_submissions_category", table_name="feedback_submissions")
    op.drop_column("feedback_submissions", "category")
