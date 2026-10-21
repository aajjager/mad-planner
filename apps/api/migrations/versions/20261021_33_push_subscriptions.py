"""Add opt-in device subscriptions; preserve existing accounts and preferences."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_33"
down_revision = "20261019_32"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("user_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.String(100), nullable=False),
        sa.Column("auth", sa.String(30), nullable=False),
        sa.Column("sent", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_push_subscriptions_session_id", "push_subscriptions", ["session_id"])


def downgrade():
    op.drop_table("push_subscriptions")
