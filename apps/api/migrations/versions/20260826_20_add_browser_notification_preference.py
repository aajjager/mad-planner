"""Add a per-user browser notification preference.

Revision ID: 20260826_20
Revises: 20260826_19
"""

from alembic import op
import sqlalchemy as sa

revision = "20260826_20"
down_revision = "20260826_19"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("browser_notifications_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "browser_notifications_enabled")
