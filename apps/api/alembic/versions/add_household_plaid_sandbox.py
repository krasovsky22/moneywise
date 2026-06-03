"""add_household_plaid_sandbox

Revision ID: add_household_plaid_sandbox
Revises: f01_plaid_bank_sync
Create Date: 2026-06-03 00:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "add_household_plaid_sandbox"
down_revision: str | Sequence[str] | None = "f01_plaid_bank_sync"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE households ADD COLUMN is_plaid_sandbox BOOLEAN NOT NULL DEFAULT TRUE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE households DROP COLUMN IF EXISTS is_plaid_sandbox")
