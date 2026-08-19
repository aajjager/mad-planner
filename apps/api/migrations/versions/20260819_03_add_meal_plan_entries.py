"""Add weekly meal plan entries."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260819_03"
down_revision: str | None = "20260819_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meal_plan_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meal_date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.Enum("breakfast", "lunch", "dinner", name="meal_type", native_enum=False), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("servings", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("notes", sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], name="fk_meal_plan_entries_recipe_id_recipes", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_meal_plan_entries"),
        sa.UniqueConstraint("meal_date", "meal_type", name="uq_meal_plan_entries_date_type"),
    )
    op.create_index("ix_meal_plan_entries_meal_date", "meal_plan_entries", ["meal_date"], unique=False)
    op.create_index("ix_meal_plan_entries_recipe_id", "meal_plan_entries", ["recipe_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_meal_plan_entries_recipe_id", table_name="meal_plan_entries")
    op.drop_index("ix_meal_plan_entries_meal_date", table_name="meal_plan_entries")
    op.drop_table("meal_plan_entries")
