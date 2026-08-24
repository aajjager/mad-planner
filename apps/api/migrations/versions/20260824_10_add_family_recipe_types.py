"""Add family-managed recipe types."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260824_10"
down_revision: str | None = "20260824_09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_TYPES = (
    ("Breakfast", "breakfast", "breakfast"),
    ("Lunch", "lunch", "lunch"),
    ("Dinner", "dinner", "dinner"),
    ("Bake-off", "bake-off", None),
    ("Cake", "cake", None),
    ("Dessert", "dessert", None),
    ("Bread", "bread", None),
    ("Snack", "snack", None),
)


def upgrade() -> None:
    op.create_table(
        "recipe_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("normalized_name", sa.String(length=60), nullable=False),
        sa.Column("meal_type", sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], name=op.f("fk_recipe_types_family_id_families"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recipe_types")),
        sa.UniqueConstraint("family_id", "normalized_name", name="uq_recipe_types_family_normalized_name"),
    )
    op.create_index(op.f("ix_recipe_types_family_id"), "recipe_types", ["family_id"], unique=False)
    op.create_table(
        "recipe_recipe_types",
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("recipe_type_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], name=op.f("fk_recipe_recipe_types_recipe_id_recipes"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipe_type_id"], ["recipe_types.id"], name=op.f("fk_recipe_recipe_types_recipe_type_id_recipe_types"), ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("recipe_id", "recipe_type_id", name=op.f("pk_recipe_recipe_types")),
    )

    for name, normalized, meal_type in DEFAULT_TYPES:
        escaped_name = name.replace("'", "''")
        escaped_normalized = normalized.replace("'", "''")
        meal_value = f"'{meal_type}'" if meal_type else "NULL"
        op.execute(
            f"INSERT INTO recipe_types (family_id, name, normalized_name, meal_type) "
            f"SELECT id, '{escaped_name}', '{escaped_normalized}', {meal_value} FROM families"
        )


def downgrade() -> None:
    op.drop_table("recipe_recipe_types")
    op.drop_index(op.f("ix_recipe_types_family_id"), table_name="recipe_types")
    op.drop_table("recipe_types")
