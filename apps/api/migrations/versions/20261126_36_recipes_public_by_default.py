"""Share existing and future recipes in the community library by default."""
from alembic import op
import sqlalchemy as sa

revision = "20261126_36"
down_revision = "20261123_35"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("recipes", "is_public", existing_type=sa.Boolean(), server_default=sa.true())
    op.execute(sa.text("UPDATE recipes SET is_public = true WHERE is_public = false"))


def downgrade():
    # Keep the visibility choices saved since the upgrade.
    op.alter_column("recipes", "is_public", existing_type=sa.Boolean(), server_default=sa.false())
