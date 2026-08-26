"""Add short-lived MFA login challenges."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260826_15"
down_revision: str | None = "20260826_14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table("mfa_login_challenges", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("family_id", sa.Integer(), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(length=64), nullable=False), sa.Column("attempts", sa.Integer(), server_default="0", nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_mfa_login_challenges_user_id", "mfa_login_challenges", ["user_id"])
    op.create_index("ix_mfa_login_challenges_family_id", "mfa_login_challenges", ["family_id"])
    op.create_index("ix_mfa_login_challenges_token_hash", "mfa_login_challenges", ["token_hash"], unique=True)
    op.create_index("ix_mfa_login_challenges_expires_at", "mfa_login_challenges", ["expires_at"])


def downgrade() -> None:
    op.drop_table("mfa_login_challenges")
