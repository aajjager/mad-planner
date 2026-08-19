"""Add recipe tags."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260819_02"
down_revision: str | None = "20260818_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("normalized_name", sa.String(length=60), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
    )
    op.create_index("ix_tags_normalized_name", "tags", ["normalized_name"], unique=True)
    op.create_table(
        "recipe_tags",
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], name="fk_recipe_tags_recipe_id_recipes", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], name="fk_recipe_tags_tag_id_tags", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("recipe_id", "tag_id", name="pk_recipe_tags"),
    )


def downgrade() -> None:
    op.drop_table("recipe_tags")
    op.drop_index("ix_tags_normalized_name", table_name="tags")
    op.drop_table("tags")
