"""Scope recipes and meal plans to families."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260820_07"
down_revision: str | None = "20260820_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("family_id", sa.Integer(), nullable=True))
    op.create_foreign_key(op.f("fk_recipes_family_id_families"), "recipes", "families", ["family_id"], ["id"], ondelete="CASCADE")
    op.create_index(op.f("ix_recipes_family_id"), "recipes", ["family_id"], unique=False)

    op.add_column("meal_plan_entries", sa.Column("family_id", sa.Integer(), nullable=True))
    op.create_foreign_key(op.f("fk_meal_plan_entries_family_id_families"), "meal_plan_entries", "families", ["family_id"], ["id"], ondelete="CASCADE")
    op.create_index(op.f("ix_meal_plan_entries_family_id"), "meal_plan_entries", ["family_id"], unique=False)
    op.drop_constraint("uq_meal_plan_entries_date_type", "meal_plan_entries", type_="unique")
    op.create_unique_constraint("uq_meal_plan_entries_family_date_type", "meal_plan_entries", ["family_id", "meal_date", "meal_type"])


def downgrade() -> None:
    op.drop_constraint("uq_meal_plan_entries_family_date_type", "meal_plan_entries", type_="unique")
    op.create_unique_constraint("uq_meal_plan_entries_date_type", "meal_plan_entries", ["meal_date", "meal_type"])
    op.drop_index(op.f("ix_meal_plan_entries_family_id"), table_name="meal_plan_entries")
    op.drop_constraint(op.f("fk_meal_plan_entries_family_id_families"), "meal_plan_entries", type_="foreignkey")
    op.drop_column("meal_plan_entries", "family_id")
    op.drop_index(op.f("ix_recipes_family_id"), table_name="recipes")
    op.drop_constraint(op.f("fk_recipes_family_id_families"), "recipes", type_="foreignkey")
    op.drop_column("recipes", "family_id")
