"""epic06_transactions

Revision ID: a3f8c2b1d9e4
Revises: 76d03a4c761b
Create Date: 2026-05-31 12:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "a3f8c2b1d9e4"
down_revision: str | Sequence[str] | None = ("b2c3d4e5f6a7", "76d03a4c761b")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rename old enum, create new one, migrate column values
    op.execute("ALTER TYPE transactiontype RENAME TO transactiontype_old")
    op.execute(
        "CREATE TYPE transactiontype AS ENUM ('expense', 'income', 'transfer', 'refund')"
    )
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN transaction_type TYPE VARCHAR "
        "USING transaction_type::text"
    )
    op.execute(
        """
        ALTER TABLE transactions
        ALTER COLUMN transaction_type TYPE transactiontype
        USING CASE transaction_type
            WHEN 'charge'   THEN 'expense'::transactiontype
            WHEN 'payment'  THEN 'income'::transactiontype
            WHEN 'credit'   THEN 'refund'::transactiontype
            WHEN 'refund'   THEN 'refund'::transactiontype
            ELSE 'expense'::transactiontype
        END
        """
    )
    op.execute("DROP TYPE transactiontype_old")

    # Make statement_id nullable
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN statement_id DROP NOT NULL"
    )

    # New columns
    op.execute(
        "ALTER TABLE transactions ADD COLUMN is_split BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN parent_transaction_id UUID "
        "REFERENCES transactions(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMPTZ NULL"
    )

    # Performance indexes
    op.execute(
        "CREATE INDEX idx_transactions_household_date "
        "ON transactions (household_id, date DESC)"
    )
    op.execute(
        "CREATE INDEX idx_transactions_household_is_deleted "
        "ON transactions (household_id, is_deleted)"
    )
    op.execute(
        "CREATE INDEX idx_transactions_parent_id "
        "ON transactions (parent_transaction_id) "
        "WHERE parent_transaction_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX idx_transactions_search "
        "ON transactions USING gin("
        "to_tsvector('english', merchant_clean || ' ' || COALESCE(notes, '')))"
    )

    # TransactionAudit table
    op.execute(
        """
        CREATE TABLE transaction_audits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            change_kind VARCHAR(20) NOT NULL CHECK (
                change_kind IN ('created','edited','categorized','split','deleted','undeleted')
            ),
            before_data JSONB,
            after_data JSONB
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_transaction_audits_transaction_id "
        "ON transaction_audits(transaction_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_transaction_audits_transaction_id")
    op.execute("DROP TABLE IF EXISTS transaction_audits")

    op.execute("DROP INDEX IF EXISTS idx_transactions_search")
    op.execute("DROP INDEX IF EXISTS idx_transactions_parent_id")
    op.execute("DROP INDEX IF EXISTS idx_transactions_household_is_deleted")
    op.execute("DROP INDEX IF EXISTS idx_transactions_household_date")

    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS deleted_at")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS is_deleted")
    op.execute(
        "ALTER TABLE transactions DROP COLUMN IF EXISTS parent_transaction_id"
    )
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS is_split")

    # Restore statement_id NOT NULL (best effort — may fail if NULLs exist)
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN statement_id SET NOT NULL"
    )

    # Revert enum back to original values
    op.execute("ALTER TYPE transactiontype RENAME TO transactiontype_new")
    op.execute(
        "CREATE TYPE transactiontype AS ENUM ('charge', 'payment', 'credit', 'refund')"
    )
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN transaction_type TYPE VARCHAR "
        "USING transaction_type::text"
    )
    op.execute(
        """
        ALTER TABLE transactions
        ALTER COLUMN transaction_type TYPE transactiontype
        USING CASE transaction_type
            WHEN 'expense'  THEN 'charge'::transactiontype
            WHEN 'income'   THEN 'payment'::transactiontype
            WHEN 'transfer' THEN 'charge'::transactiontype
            WHEN 'refund'   THEN 'refund'::transactiontype
            ELSE 'charge'::transactiontype
        END
        """
    )
    op.execute("DROP TYPE transactiontype_new")
