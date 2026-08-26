"""Add personal nutrition visibility preference."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260826_18"
down_revision: str | None = "20260826_17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("show_nutrition", sa.Boolean(), server_default=sa.true(), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "show_nutrition")
