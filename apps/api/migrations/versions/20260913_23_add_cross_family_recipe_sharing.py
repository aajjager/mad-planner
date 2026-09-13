"""Add cross-family recipe sharing.

Revision ID: 20260913_23
Revises: 20260901_22
"""

from alembic import op
import sqlalchemy as sa

revision = "20260913_23"
down_revision = "20260901_22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_shares",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_family_id", sa.Integer(), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("recipe_id", "recipient_family_id", name="uq_recipe_shares_recipe_family"),
    )
    op.create_index("ix_recipe_shares_recipe_id", "recipe_shares", ["recipe_id"])
    op.create_index("ix_recipe_shares_recipient_family_id", "recipe_shares", ["recipient_family_id"])
    op.create_index("ix_recipe_shares_created_by_user_id", "recipe_shares", ["created_by_user_id"])

    op.add_column("recipe_ratings", sa.Column("family_id", sa.Integer(), nullable=True))
    op.execute("UPDATE recipe_ratings SET family_id = recipes.family_id FROM recipes WHERE recipes.id = recipe_ratings.recipe_id")
    op.alter_column("recipe_ratings", "family_id", nullable=False)
    op.create_foreign_key("fk_recipe_ratings_family_id", "recipe_ratings", "families", ["family_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_recipe_ratings_family_id", "recipe_ratings", ["family_id"])
    op.drop_constraint("uq_recipe_ratings_recipe_user", "recipe_ratings", type_="unique")
    op.create_unique_constraint("uq_recipe_ratings_recipe_user_family", "recipe_ratings", ["recipe_id", "user_id", "family_id"])


def downgrade() -> None:
    op.drop_constraint("uq_recipe_ratings_recipe_user_family", "recipe_ratings", type_="unique")
    op.create_unique_constraint("uq_recipe_ratings_recipe_user", "recipe_ratings", ["recipe_id", "user_id"])
    op.drop_index("ix_recipe_ratings_family_id", table_name="recipe_ratings")
    op.drop_constraint("fk_recipe_ratings_family_id", "recipe_ratings", type_="foreignkey")
    op.drop_column("recipe_ratings", "family_id")
    op.drop_table("recipe_shares")
