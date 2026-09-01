"""Add the family planning suggestion mode.

Revision ID: 20260901_21
Revises: 20260826_20
"""

from alembic import op
import sqlalchemy as sa

revision = "20260901_21"
down_revision = "20260826_20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "families",
        sa.Column("planning_suggestion_mode", sa.String(length=20), server_default="review", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("families", "planning_suggestion_mode")
