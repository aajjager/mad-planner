"""Classify the existing feedback backlog as feature requests.

Revision ID: 20260916_29
Revises: 20260916_28
"""

from alembic import op

revision = "20260916_29"
down_revision = "20260916_28"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE feedback_submissions SET category = 'feature' "
        "WHERE status IN ('pending', 'approved')"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE feedback_submissions SET category = 'improvement' "
        "WHERE status IN ('pending', 'approved') AND category = 'feature'"
    )
