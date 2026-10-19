"""Add administrator answers without changing existing feedback."""

from alembic import op
import sqlalchemy as sa

revision = "20261019_31"
down_revision = "20260928_30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feedback_submissions", sa.Column("is_question", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("feedback_submissions", sa.Column("answer", sa.Text(), nullable=True))
    op.add_column("feedback_submissions", sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("feedback_submissions", sa.Column("answer_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for column in ("answer_seen_at", "answered_at", "answer", "is_question"):
        op.drop_column("feedback_submissions", column)
