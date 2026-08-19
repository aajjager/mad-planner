"""Add recipe meal type classifications."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260820_05"
down_revision: str | None = "20260819_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("meal_types", sa.JSON(), server_default=sa.text("'[]'"), nullable=False))


def downgrade() -> None:
    op.drop_column("recipes", "meal_types")
