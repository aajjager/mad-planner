"""Add public recipes and feedback attachments.

Revision ID: 20260915_27
Revises: 20260915_26
"""

from alembic import op
import sqlalchemy as sa

revision = "20260915_27"
down_revision = "20260915_26"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recipes", sa.Column("is_public", sa.Boolean(), server_default="false", nullable=False))
    op.create_index("ix_recipes_is_public", "recipes", ["is_public"])
    op.add_column("feedback_submissions", sa.Column("attachment_url", sa.Text(), nullable=True))
    op.add_column("feedback_submissions", sa.Column("attachment_name", sa.String(length=255), nullable=True))
    op.add_column("feedback_submissions", sa.Column("attachment_content_type", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("feedback_submissions", "attachment_content_type")
    op.drop_column("feedback_submissions", "attachment_name")
    op.drop_column("feedback_submissions", "attachment_url")
    op.drop_index("ix_recipes_is_public", table_name="recipes")
    op.drop_column("recipes", "is_public")
