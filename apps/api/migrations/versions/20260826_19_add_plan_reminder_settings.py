"""Add family meal-plan reminder settings."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260826_19"
down_revision: str | None = "20260826_18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("families", sa.Column("plan_reminders_enabled", sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column("families", sa.Column("plan_reminder_weeks", sa.Integer(), server_default="1", nullable=False))


def downgrade() -> None:
    op.drop_column("families", "plan_reminder_weeks")
    op.drop_column("families", "plan_reminders_enabled")
