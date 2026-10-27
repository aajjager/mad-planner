"""Opt-in family sharing and personal community filters."""
from alembic import op
import sqlalchemy as sa

revision = "20261027_34"
down_revision = "20261021_33"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("families", sa.Column("always_share_recipes", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("hidden_recipe_family_ids", sa.JSON(), nullable=False, server_default="[]"))


def downgrade():
    op.drop_column("users", "hidden_recipe_family_ids")
    op.drop_column("families", "always_share_recipes")
