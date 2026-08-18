"""Create the initial recipe and ingredient schema."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260818_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("normalized_name", sa.String(length=200), nullable=False),
        sa.Column("grocery_category", sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_ingredients"),
    )
    op.create_index("ix_ingredients_normalized_name", "ingredients", ["normalized_name"], unique=True)

    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("author", sa.String(length=200), nullable=True),
        sa.Column("servings", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("preparation_time_minutes", sa.Integer(), nullable=True),
        sa.Column("cooking_time_minutes", sa.Integer(), nullable=True),
        sa.Column("total_time_minutes", sa.Integer(), nullable=True),
        sa.Column("cuisine", sa.String(length=100), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("nutrition", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_recipes"),
    )
    op.create_index("ix_recipes_category", "recipes", ["category"], unique=False)
    op.create_index("ix_recipes_cuisine", "recipes", ["cuisine"], unique=False)
    op.create_index("ix_recipes_name", "recipes", ["name"], unique=False)

    op.create_table(
        "units",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("dimension", sa.Enum("mass", "volume", "count", name="unit_dimension", native_enum=False), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_units"),
        sa.UniqueConstraint("name", name="uq_units_name"),
    )

    op.create_table(
        "ingredient_aliases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=False),
        sa.Column("alias", sa.String(length=200), nullable=False),
        sa.Column("normalized_alias", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"], name="fk_ingredient_aliases_ingredient_id_ingredients", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_ingredient_aliases"),
        sa.UniqueConstraint("normalized_alias", name="uq_ingredient_aliases_normalized_alias"),
    )
    op.create_index("ix_ingredient_aliases_ingredient_id", "ingredient_aliases", ["ingredient_id"], unique=False)

    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=True),
        sa.Column("unit_id", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("quantity_max", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("preparation", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"], name="fk_recipe_ingredients_ingredient_id_ingredients", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], name="fk_recipe_ingredients_recipe_id_recipes", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["unit_id"], ["units.id"], name="fk_recipe_ingredients_unit_id_units", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_recipe_ingredients"),
        sa.UniqueConstraint("recipe_id", "position", name="uq_recipe_ingredients_recipe_position"),
    )
    op.create_index("ix_recipe_ingredients_ingredient_id", "recipe_ingredients", ["ingredient_id"], unique=False)
    op.create_index("ix_recipe_ingredients_recipe_id", "recipe_ingredients", ["recipe_id"], unique=False)

    op.create_table(
        "recipe_instructions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], name="fk_recipe_instructions_recipe_id_recipes", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_recipe_instructions"),
        sa.UniqueConstraint("recipe_id", "position", name="uq_recipe_instructions_recipe_position"),
    )
    op.create_index("ix_recipe_instructions_recipe_id", "recipe_instructions", ["recipe_id"], unique=False)


def downgrade() -> None:
    op.drop_table("recipe_instructions")
    op.drop_table("recipe_ingredients")
    op.drop_table("ingredient_aliases")
    op.drop_table("units")
    op.drop_table("recipes")
    op.drop_table("ingredients")

