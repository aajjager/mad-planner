"""Add household and planning preferences to families."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260824_08"
down_revision: str | None = "20260820_07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("families", sa.Column("household_size", sa.Integer(), server_default="2", nullable=False))
    op.add_column("families", sa.Column("leftovers_enabled", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("families", sa.Column("cooking_mode_enabled", sa.Boolean(), server_default="true", nullable=False))
    op.add_column(
        "families",
        sa.Column(
            "enabled_meal_types",
            sa.JSON(),
            server_default=sa.text("'[\"breakfast\", \"lunch\", \"dinner\"]'"),
            nullable=False,
        ),
    )
    op.create_check_constraint("household_size_between_1_and_50", "families", "household_size >= 1 AND household_size <= 50")


def downgrade() -> None:
    op.drop_constraint("ck_families_household_size_between_1_and_50", "families", type_="check")
    op.drop_column("families", "enabled_meal_types")
    op.drop_column("families", "cooking_mode_enabled")
    op.drop_column("families", "leftovers_enabled")
    op.drop_column("families", "household_size")
