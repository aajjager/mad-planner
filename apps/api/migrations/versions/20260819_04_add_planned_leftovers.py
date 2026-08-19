"""Add planned leftover relationships."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260819_04"
down_revision: str | None = "20260819_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("meal_plan_entries", sa.Column("is_leftover", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("meal_plan_entries", sa.Column("source_entry_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_meal_plan_entries_source_entry_id_meal_plan_entries", "meal_plan_entries", "meal_plan_entries", ["source_entry_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_meal_plan_entries_source_entry_id", "meal_plan_entries", ["source_entry_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_meal_plan_entries_source_entry_id", table_name="meal_plan_entries")
    op.drop_constraint("fk_meal_plan_entries_source_entry_id_meal_plan_entries", "meal_plan_entries", type_="foreignkey")
    op.drop_column("meal_plan_entries", "source_entry_id")
    op.drop_column("meal_plan_entries", "is_leftover")
