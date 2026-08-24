"""Add persistent grocery list entries."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260824_11"
down_revision: str | None = "20260824_10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table("grocery_list_entries",
        sa.Column("id", sa.Integer(), nullable=False), sa.Column("family_id", sa.Integer(), nullable=False), sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("source_key", sa.String(length=300), nullable=True), sa.Column("origin", sa.String(length=20), nullable=False), sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False), sa.Column("quantity", sa.Numeric(12, 4), nullable=True), sa.Column("quantity_max", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit", sa.JSON(), nullable=True), sa.Column("raw_text", sa.String(length=500), nullable=False), sa.Column("recipe_names", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False), sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("family_id", "week_start", "source_key", name="uq_grocery_entries_family_week_source"))
    op.create_index(op.f("ix_grocery_list_entries_family_id"), "grocery_list_entries", ["family_id"], unique=False)
    op.create_index(op.f("ix_grocery_list_entries_week_start"), "grocery_list_entries", ["week_start"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_grocery_list_entries_week_start"), table_name="grocery_list_entries")
    op.drop_index(op.f("ix_grocery_list_entries_family_id"), table_name="grocery_list_entries")
    op.drop_table("grocery_list_entries")
