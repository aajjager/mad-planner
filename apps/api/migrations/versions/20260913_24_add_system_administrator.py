"""Add the system administrator flag.

Revision ID: 20260913_24
Revises: 20260913_23
"""

from alembic import op
import sqlalchemy as sa

revision = "20260913_24"
down_revision = "20260913_23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_system_admin", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.execute("UPDATE users SET is_system_admin = true WHERE id = (SELECT min(id) FROM users)")


def downgrade() -> None:
    op.drop_column("users", "is_system_admin")
