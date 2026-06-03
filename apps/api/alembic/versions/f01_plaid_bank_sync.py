"""f01_plaid_bank_sync

Revision ID: f01_plaid_bank_sync
Revises: a3f8c2b1d9e4
Create Date: 2026-06-03 00:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "f01_plaid_bank_sync"
down_revision: str | Sequence[str] | None = "a3f8c2b1d9e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create enums
    op.execute(
        "CREATE TYPE plaiditemstatus AS ENUM "
        "('good', 'degraded', 'login_required', 'error')"
    )
    op.execute("CREATE TYPE plaidsynctype AS ENUM ('cron', 'manual')")

    # 2. Add 'credit' to existing accounttype enum
    op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'credit'")

    # 3. Create plaid_items table
    op.execute(
        """
        CREATE TABLE plaid_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            plaid_item_id VARCHAR(255) NOT NULL,
            plaid_access_token VARCHAR(1024) NOT NULL,
            plaid_institution_id VARCHAR(255) NOT NULL,
            institution_name VARCHAR(255) NOT NULL,
            institution_logo_url VARCHAR(2048),
            institution_color VARCHAR(20),
            cursor VARCHAR(1024),
            status plaiditemstatus NOT NULL DEFAULT 'good',
            error_code VARCHAR(100),
            last_synced_at TIMESTAMPTZ,
            consent_expires_at TIMESTAMPTZ,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        )
        """
    )
    op.execute("CREATE INDEX idx_plaid_items_household_id ON plaid_items(household_id)")
    op.execute("CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id)")

    # 4. Create plaid_sync_log table
    op.execute(
        """
        CREATE TABLE plaid_sync_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
            sync_type plaidsynctype NOT NULL DEFAULT 'manual',
            cursor_before VARCHAR(1024),
            cursor_after VARCHAR(1024),
            added_count INTEGER NOT NULL DEFAULT 0,
            modified_count INTEGER NOT NULL DEFAULT 0,
            removed_count INTEGER NOT NULL DEFAULT 0,
            error VARCHAR(1024),
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "CREATE INDEX idx_plaid_sync_log_plaid_item_id ON plaid_sync_log(plaid_item_id)"
    )

    # 5. Add Plaid columns to bank_accounts
    op.execute("ALTER TABLE bank_accounts ADD COLUMN plaid_account_id VARCHAR(255)")
    op.execute(
        "ALTER TABLE bank_accounts ADD COLUMN plaid_item_id UUID "
        "REFERENCES plaid_items(id) ON DELETE SET NULL"
    )
    op.execute("ALTER TABLE bank_accounts ADD COLUMN official_name VARCHAR(255)")
    op.execute("ALTER TABLE bank_accounts ADD COLUMN subtype VARCHAR(50)")
    op.execute(
        "ALTER TABLE bank_accounts ADD COLUMN current_balance NUMERIC(12, 2)"
    )
    op.execute(
        "ALTER TABLE bank_accounts ADD COLUMN available_balance NUMERIC(12, 2)"
    )
    op.execute(
        "ALTER TABLE bank_accounts ADD COLUMN credit_limit NUMERIC(12, 2)"
    )
    op.execute(
        "ALTER TABLE bank_accounts ADD COLUMN currency_code VARCHAR(10) NOT NULL DEFAULT 'USD'"
    )
    op.execute(
        "ALTER TABLE bank_accounts ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"
    )
    op.execute(
        "CREATE INDEX idx_bank_accounts_plaid_account_id ON bank_accounts(plaid_account_id)"
    )
    op.execute(
        "CREATE INDEX idx_bank_accounts_plaid_item_id ON bank_accounts(plaid_item_id)"
    )

    # 6. Add plaid_account_id to cards
    op.execute("ALTER TABLE cards ADD COLUMN plaid_account_id VARCHAR(255)")
    op.execute(
        "CREATE INDEX idx_cards_plaid_account_id ON cards(plaid_account_id)"
    )

    # 7. Add Plaid columns to transactions
    op.execute(
        "ALTER TABLE transactions ADD COLUMN plaid_transaction_id VARCHAR(255)"
    )
    op.execute(
        "CREATE UNIQUE INDEX idx_transactions_plaid_transaction_id "
        "ON transactions(plaid_transaction_id) "
        "WHERE plaid_transaction_id IS NOT NULL"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN pending BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN source VARCHAR(50) "
        "NOT NULL DEFAULT 'statement'"
    )

    # 8. Remove confidence columns from transactions
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS confidence_date")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS confidence_amount")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS confidence_merchant")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS confidence_category")

    # 9. Remove statement_id from transactions (drop index first)
    op.execute("DROP INDEX IF EXISTS ix_transactions_statement_id")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS statement_id")

    # 10. Drop statements and issuer_schemas tables
    op.execute("DROP TABLE IF EXISTS statements CASCADE")
    op.execute("DROP TABLE IF EXISTS issuer_schemas CASCADE")


def downgrade() -> None:
    # Recreate statements table (schema only, no data)
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS statements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
            bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            filename VARCHAR(500),
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS issuer_schemas (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            issuer_key VARCHAR(100) NOT NULL UNIQUE,
            column_map JSONB NOT NULL DEFAULT '{}',
            date_format VARCHAR(50),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    # Restore statement_id on transactions
    op.execute(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS statement_id UUID "
        "REFERENCES statements(id) ON DELETE CASCADE"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_transactions_statement_id "
        "ON transactions(statement_id)"
    )

    # Restore confidence columns
    op.execute(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence_date FLOAT"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence_amount FLOAT"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence_merchant FLOAT"
    )
    op.execute(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confidence_category FLOAT"
    )

    # Remove Plaid transaction columns
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS source")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS pending")
    op.execute("DROP INDEX IF EXISTS idx_transactions_plaid_transaction_id")
    op.execute(
        "ALTER TABLE transactions DROP COLUMN IF EXISTS plaid_transaction_id"
    )

    # Remove plaid_account_id from cards
    op.execute("DROP INDEX IF EXISTS idx_cards_plaid_account_id")
    op.execute("ALTER TABLE cards DROP COLUMN IF EXISTS plaid_account_id")

    # Remove Plaid columns from bank_accounts
    op.execute("DROP INDEX IF EXISTS idx_bank_accounts_plaid_item_id")
    op.execute("DROP INDEX IF EXISTS idx_bank_accounts_plaid_account_id")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS is_active")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS currency_code")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS credit_limit")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS available_balance")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS current_balance")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS subtype")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS official_name")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS plaid_item_id")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS plaid_account_id")

    # Drop plaid_sync_log
    op.execute("DROP INDEX IF EXISTS idx_plaid_sync_log_plaid_item_id")
    op.execute("DROP TABLE IF EXISTS plaid_sync_log")

    # Drop plaid_items
    op.execute("DROP INDEX IF EXISTS idx_plaid_items_user_id")
    op.execute("DROP INDEX IF EXISTS idx_plaid_items_household_id")
    op.execute("DROP TABLE IF EXISTS plaid_items")

    op.execute("DROP TYPE IF EXISTS plaidsynctype")
    op.execute("DROP TYPE IF EXISTS plaiditemstatus")
