"""Add Beverages to existing families without changing their recipe types."""
from alembic import op
import sqlalchemy as sa

revision = "20261123_35"
down_revision = "20261027_34"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        INSERT INTO recipe_types (family_id, name, normalized_name, meal_type)
        SELECT f.id, 'Beverages', 'beverages', NULL FROM families f
        WHERE NOT EXISTS (
            SELECT 1 FROM recipe_types t
            WHERE t.family_id = f.id AND t.normalized_name = 'beverages'
        )
    """))


def downgrade():
    # Keep this data-only addition: deleting a type could orphan saved recipes,
    # and older app versions already support custom types such as Beverages.
    pass
