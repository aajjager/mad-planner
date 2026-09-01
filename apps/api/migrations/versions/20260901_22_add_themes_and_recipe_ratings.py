"""Add personal themes and family recipe ratings.

Revision ID: 20260901_22
Revises: 20260901_21
"""

from alembic import op
import sqlalchemy as sa

revision = "20260901_22"
down_revision = "20260901_21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("dark_mode", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("users", sa.Column("accent_theme", sa.String(length=20), server_default="sage", nullable=False))
    op.add_column("families", sa.Column("rating_filter_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("families", sa.Column("rating_minimum", sa.Integer(), server_default="3", nullable=False))
    op.add_column("families", sa.Column("rating_target_percent", sa.Integer(), server_default="50", nullable=False))
    op.create_table("recipe_ratings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("rating", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("recipe_id", "user_id", name="uq_recipe_ratings_recipe_user"))
    op.create_index("ix_recipe_ratings_recipe_id", "recipe_ratings", ["recipe_id"])
    op.create_index("ix_recipe_ratings_user_id", "recipe_ratings", ["user_id"])


def downgrade() -> None:
    op.drop_table("recipe_ratings")
    op.drop_column("families", "rating_target_percent")
    op.drop_column("families", "rating_minimum")
    op.drop_column("families", "rating_filter_enabled")
    op.drop_column("users", "accent_theme")
    op.drop_column("users", "dark_mode")
