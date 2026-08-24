"""Add personal user locale."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260824_12"
down_revision: str | None = "20260824_11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("locale", sa.String(length=10), server_default="en", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "locale")
