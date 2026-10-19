"""Persist implementation jobs without changing existing feedback or family data."""
from alembic import op
import sqlalchemy as sa

revision = "20261019_32"
down_revision = "20261019_31"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("implementation_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("feedback_id", sa.Integer(), sa.ForeignKey("feedback_submissions.id", ondelete="SET NULL")),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("request_text", sa.Text(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("claim_hash", sa.String(64)),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_implementation_jobs_feedback_id", "implementation_jobs", ["feedback_id"])
    op.create_index("ix_implementation_jobs_status", "implementation_jobs", ["status"])


def downgrade():
    op.drop_table("implementation_jobs")
