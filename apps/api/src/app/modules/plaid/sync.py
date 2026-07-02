from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import case, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.bank_accounts.models import BankAccount
from app.modules.categories.models import Category, CategoryRule
from app.modules.categories.service import apply_rules, list_rules
from app.modules.household.models import Household
from app.modules.plaid import client as plaid_client
from app.modules.plaid.crypto import decrypt_token
from app.modules.plaid.models import (
    PlaidItem,
    PlaidItemStatus,
    PlaidSyncLog,
    PlaidSyncType,
)
from app.modules.transactions.models import Transaction, TransactionType

logger = structlog.get_logger(__name__)


def _tx_to_json_safe(tx: dict[str, Any]) -> dict[str, Any]:
    """Convert date/Decimal objects in Plaid tx dict to JSON-safe types."""
    result: dict[str, Any] = {}
    for k, v in tx.items():
        if isinstance(v, date):
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = _tx_to_json_safe(v)
        elif isinstance(v, list):
            result[k] = [_tx_to_json_safe(i) if isinstance(i, dict) else i for i in v]
        else:
            result[k] = v
    return result


CATEGORY_MAP: dict[str, str] = {
    "FOOD_AND_DRINK": "Food & Drink",
    "TRANSPORTATION": "Transportation",
    "ENTERTAINMENT": "Entertainment",
    "MEDICAL": "Health",
    "TRAVEL": "Travel",
    "PERSONAL_CARE": "Personal Care",
    "HOME_IMPROVEMENT": "Housing",
    "RENT_AND_UTILITIES": "Housing",
    "GENERAL_MERCHANDISE": "Shopping",
    "GENERAL_SERVICES": "Other",
    "LOAN_PAYMENTS": "Financial",
    "BANK_FEES": "Financial",
    "TRANSFER_IN": "Financial",
    "TRANSFER_OUT": "Financial",
    "GOVERNMENT_AND_NON_PROFIT": "Gifts & Donations",
}


async def _find_category_id(
    db: AsyncSession, household_id: object, category_name: str
) -> tuple[str | None, bool]:
    result = await db.execute(
        select(Category).where(
            Category.name == category_name,
            (Category.household_id == household_id) | Category.is_system.is_(True),
        )
    )
    cat = result.scalars().first()
    if cat is not None:
        return str(cat.id), False
    return None, True


async def _resolve_bank_account(
    db: AsyncSession, plaid_account_id: str
) -> BankAccount | None:
    result = await db.execute(
        select(BankAccount).where(BankAccount.plaid_account_id == plaid_account_id)
    )
    return result.scalar_one_or_none()


def _determine_tx_type(amount: float, acct_type: str) -> TransactionType:
    if acct_type == "credit":
        if amount > 0:
            return TransactionType.expense
        return TransactionType.refund
    if amount < 0:
        return TransactionType.income
    return TransactionType.expense


async def sync_item(
    db: AsyncSession,
    plaid_item: PlaidItem,
    sync_type: PlaidSyncType = PlaidSyncType.manual,
) -> PlaidSyncLog:
    access_token = decrypt_token(plaid_item.plaid_access_token)
    cursor_before = plaid_item.cursor
    cursor_after = cursor_before

    household_result = await db.execute(
        select(Household).where(Household.id == plaid_item.household_id)
    )
    _hh = household_result.scalar_one_or_none()
    is_sandbox = _hh.is_plaid_sandbox if _hh is not None else True

    log = PlaidSyncLog(
        plaid_item_id=plaid_item.id,
        sync_type=sync_type,
        cursor_before=cursor_before,
    )
    db.add(log)
    # Persist the log row up front so it survives a mid-sync rollback.
    await db.commit()

    rules = await list_rules(db, plaid_item.household_id)

    total_added = 0
    total_modified = 0
    total_removed = 0
    error_msg: str | None = None

    try:
        has_more = True
        current_cursor = cursor_before

        while has_more:
            page = await asyncio.to_thread(
                plaid_client.sync_transactions, access_token, current_cursor, is_sandbox
            )

            for tx in page["added"]:
                await _upsert_transaction(db, plaid_item, tx, rules)
                total_added += 1

            for tx in page["modified"]:
                await _upsert_transaction(db, plaid_item, tx, rules)
                total_modified += 1

            for plaid_tx_id in page["removed"]:
                await _soft_delete_transaction(db, plaid_item, plaid_tx_id)
                total_removed += 1

            current_cursor = page["next_cursor"]
            has_more = page["has_more"]

            if current_cursor:
                plaid_item.cursor = current_cursor

            # Commit each page atomically: the cursor only ever advances
            # together with the transactions fetched under it, so a failure
            # on a later page can never skip data on resume.
            await db.commit()
            if current_cursor:
                cursor_after = current_cursor

        plaid_item.last_synced_at = datetime.now(UTC)

    except Exception as exc:
        await db.rollback()
        # rollback expires ORM state; reload before mutating.
        await db.refresh(plaid_item)
        await db.refresh(log)
        error_msg = str(exc)
        plaid_item.status = PlaidItemStatus.error
        logger.exception(
            "plaid_sync_failed",
            plaid_item_id=str(plaid_item.id),
            household_id=str(plaid_item.household_id),
            sync_type=sync_type.value,
            cursor_before=cursor_before,
        )

    log.cursor_after = cursor_after
    log.added_count = total_added
    log.modified_count = total_modified
    log.removed_count = total_removed
    log.error = error_msg
    log.completed_at = datetime.now(UTC)
    await db.commit()

    if error_msg is None:
        logger.info(
            "plaid_sync_completed",
            plaid_item_id=str(plaid_item.id),
            added=total_added,
            modified=total_modified,
            removed=total_removed,
        )

    return log


async def _upsert_transaction(
    db: AsyncSession,
    plaid_item: PlaidItem,
    tx: dict[str, Any],
    rules: list[CategoryRule],
) -> None:
    plaid_tx_id: str = tx["transaction_id"]
    plaid_account_id: str = tx["account_id"]

    bank_account = await _resolve_bank_account(db, plaid_account_id)
    if bank_account is None:
        return

    acct_type = (
        "credit" if bank_account.account_type.value == "credit" else "depository"
    )
    raw_amount: float = tx["amount"]
    amount = abs(Decimal(str(raw_amount)))
    tx_type = _determine_tx_type(raw_amount, acct_type)

    tx_date_raw = tx.get("date") or tx.get("authorized_date")
    if isinstance(tx_date_raw, date):
        tx_date = tx_date_raw
    elif isinstance(tx_date_raw, str):
        tx_date = date.fromisoformat(tx_date_raw)
    else:
        tx_date = datetime.now(UTC).date()

    merchant_name = tx.get("merchant_name") or tx.get("name") or ""
    pending: bool = tx.get("pending", False)

    pfc_primary: str | None = tx.get("personal_finance_category_primary")
    category_id: str | None = None
    is_low_confidence = True

    # Household merchant rules take precedence over Plaid's category.
    matched_rule = apply_rules(rules, merchant_name) if merchant_name else None
    if matched_rule is not None:
        category_id = str(matched_rule.category_id)
        is_low_confidence = False
    elif pfc_primary and pfc_primary in CATEGORY_MAP:
        mapped_name = CATEGORY_MAP[pfc_primary]
        category_id, is_low_confidence = await _find_category_id(
            db, plaid_item.household_id, mapped_name
        )

    raw_metadata = _tx_to_json_safe(tx)

    stmt = pg_insert(Transaction).values(
        household_id=plaid_item.household_id,
        card_id=None,
        bank_account_id=bank_account.id,
        date=tx_date,
        amount=amount,
        merchant_clean=merchant_name,
        merchant_raw=merchant_name,
        transaction_type=tx_type.value,
        category_id=category_id,
        is_low_confidence=is_low_confidence,
        is_user_confirmed=False,
        is_split=False,
        is_deleted=False,
        pending=pending,
        source="plaid",
        plaid_transaction_id=plaid_tx_id,
        plaid_raw_metadata=raw_metadata,
    )

    # For user-confirmed transactions keep the user's categorization and
    # merchant edits; the bank stays authoritative for amount/date/pending.
    confirmed = Transaction.is_user_confirmed.is_(True)
    stmt = stmt.on_conflict_do_update(
        index_elements=["plaid_transaction_id"],
        index_where=text("plaid_transaction_id IS NOT NULL"),
        set_={
            "amount": stmt.excluded.amount,
            "merchant_clean": case(
                (confirmed, Transaction.merchant_clean),
                else_=stmt.excluded.merchant_clean,
            ),
            "merchant_raw": stmt.excluded.merchant_raw,
            "date": stmt.excluded.date,
            "transaction_type": case(
                (confirmed, Transaction.transaction_type),
                else_=stmt.excluded.transaction_type,
            ),
            "category_id": case(
                (confirmed, Transaction.category_id),
                else_=stmt.excluded.category_id,
            ),
            "is_low_confidence": case(
                (confirmed, Transaction.is_low_confidence),
                else_=stmt.excluded.is_low_confidence,
            ),
            "pending": stmt.excluded.pending,
            "plaid_raw_metadata": stmt.excluded.plaid_raw_metadata,
            "updated_at": datetime.now(UTC),
        },
    )
    await db.execute(stmt)


async def _soft_delete_transaction(
    db: AsyncSession,
    plaid_item: PlaidItem,
    plaid_tx_id: str,
) -> None:
    await db.execute(
        update(Transaction)
        .where(
            Transaction.plaid_transaction_id == plaid_tx_id,
            Transaction.household_id == plaid_item.household_id,
        )
        .values(
            is_deleted=True,
            deleted_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
    )
