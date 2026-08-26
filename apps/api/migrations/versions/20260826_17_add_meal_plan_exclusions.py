"""Add excluded meal-plan slots."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260826_17"
down_revision: str | None = "20260826_16"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table("meal_plan_exclusions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("family_id", sa.Integer(), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False), sa.Column("meal_date", sa.Date(), nullable=False), sa.Column("meal_type", sa.Enum("breakfast", "lunch", "dinner", name="meal_type", native_enum=False), nullable=False), sa.UniqueConstraint("family_id", "meal_date", "meal_type", name="uq_meal_plan_exclusions_family_date_type"))
    op.create_index(op.f("ix_meal_plan_exclusions_family_id"), "meal_plan_exclusions", ["family_id"])
    op.create_index(op.f("ix_meal_plan_exclusions_meal_date"), "meal_plan_exclusions", ["meal_date"])


def downgrade() -> None:
    op.drop_table("meal_plan_exclusions")
