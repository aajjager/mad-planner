"""Add IP addresses to login security events.

Revision ID: 20260928_30
Revises: 20260916_29
"""

from alembic import op
import sqlalchemy as sa


revision = "20260928_30"
down_revision = "20260916_29"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("security_events", sa.Column("ip_address", sa.String(length=45), nullable=True))


def downgrade() -> None:
    op.drop_column("security_events", "ip_address")
