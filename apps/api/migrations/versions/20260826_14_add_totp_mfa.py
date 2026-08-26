"""Add encrypted TOTP MFA state to users."""

from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20260826_14"
down_revision: str | None = "20260826_13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("mfa_secret_encrypted", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("mfa_recovery_code_hashes", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "mfa_recovery_code_hashes")
    op.drop_column("users", "mfa_secret_encrypted")
    op.drop_column("users", "mfa_enabled")
