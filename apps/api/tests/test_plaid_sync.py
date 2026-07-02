from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.bank_accounts.models import AccountType, BankAccount
from app.modules.categories.models import Category, CategoryRule
from app.modules.plaid.models import PlaidItem, PlaidItemStatus
from app.modules.plaid.sync import sync_item
from app.modules.transactions.models import Transaction, TransactionType

_REGISTER_URL = "/api/v1/auth/register"
_EMAIL = "plaid_sync_user@example.com"
_PASSWORD = "securepassword123"


def _plaid_tx(
    tx_id: str,
    amount: float,
    name: str,
    date: str = "2026-06-01",
    pending: bool = False,
) -> dict[str, Any]:
    return {
        "transaction_id": tx_id,
        "account_id": "acct-1",
        "name": name,
        "merchant_name": name,
        "amount": amount,
        "date": date,
        "authorized_date": None,
        "pending": pending,
        "personal_finance_category_primary": None,
        "personal_finance_category": None,
        "counterparties": [],
    }


def _page(
    added: list[dict[str, Any]] | None = None,
    modified: list[dict[str, Any]] | None = None,
    removed: list[str] | None = None,
    cursor: str = "cursor-1",
) -> dict[str, Any]:
    return {
        "added": added or [],
        "modified": modified or [],
        "removed": removed or [],
        "next_cursor": cursor,
        "has_more": False,
    }


@pytest.fixture
def plaid_pages(monkeypatch: pytest.MonkeyPatch) -> list[Any]:
    """Queue of fake transactions_sync pages; an Exception entry raises."""
    pages: list[Any] = []

    def fake_sync(
        access_token: str, cursor: str | None, is_sandbox: bool = True
    ) -> dict[str, Any]:
        item = pages.pop(0)
        if isinstance(item, Exception):
            raise item
        return dict(item)

    monkeypatch.setattr("app.modules.plaid.client.sync_transactions", fake_sync)
    monkeypatch.setattr(
        "app.modules.plaid.sync.decrypt_token", lambda token: "decrypted"
    )
    return pages


async def _provision(
    db_client: AsyncClient, db_session: AsyncSession
) -> tuple[uuid.UUID, PlaidItem]:
    resp = await db_client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    hh = await db_client.get("/api/v1/household", headers=headers)
    assert hh.status_code == 200
    household_id = uuid.UUID(hh.json()["id"])

    item = PlaidItem(
        household_id=household_id,
        plaid_item_id="item-1",
        plaid_access_token="encrypted-token",
        plaid_institution_id="ins_1",
        institution_name="Test Bank",
    )
    db_session.add(item)
    await db_session.flush()
    db_session.add(
        BankAccount(
            household_id=household_id,
            nickname="Checking",
            institution="Test Bank",
            account_type=AccountType.checking,
            plaid_account_id="acct-1",
            plaid_item_id=item.id,
        )
    )
    await db_session.commit()
    return household_id, item


async def _get_tx(db_session: AsyncSession, plaid_tx_id: str) -> Transaction:
    result = await db_session.execute(
        select(Transaction)
        .where(Transaction.plaid_transaction_id == plaid_tx_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def test_sync_adds_transactions(
    db_client: AsyncClient, db_session: AsyncSession, plaid_pages: list[Any]
) -> None:
    _, item = await _provision(db_client, db_session)
    plaid_pages.append(
        _page(
            added=[
                _plaid_tx("tx-1", 12.50, "Coffee Shop"),
                _plaid_tx("tx-2", -1500.00, "Payroll"),
            ]
        )
    )

    log = await sync_item(db_session, item)

    assert log.error is None
    assert log.added_count == 2
    assert log.cursor_after == "cursor-1"
    assert item.cursor == "cursor-1"
    assert item.last_synced_at is not None

    expense = await _get_tx(db_session, "tx-1")
    assert expense.amount == Decimal("12.50")
    assert expense.transaction_type == TransactionType.expense
    assert expense.source == "plaid"
    assert expense.is_user_confirmed is False

    income = await _get_tx(db_session, "tx-2")
    assert income.transaction_type == TransactionType.income
    assert income.amount == Decimal("1500.00")


async def test_sync_applies_household_rule(
    db_client: AsyncClient, db_session: AsyncSession, plaid_pages: list[Any]
) -> None:
    household_id, item = await _provision(db_client, db_session)

    category = Category(household_id=household_id, name="Coffee")
    db_session.add(category)
    await db_session.flush()
    category_id = category.id
    db_session.add(
        CategoryRule(
            household_id=household_id,
            pattern="starbucks",
            category_id=category_id,
        )
    )
    await db_session.commit()

    plaid_pages.append(_page(added=[_plaid_tx("tx-rule", 8.00, "Starbucks #4821")]))
    await sync_item(db_session, item)

    tx = await _get_tx(db_session, "tx-rule")
    assert tx.category_id == category_id
    assert tx.is_low_confidence is False


async def test_sync_preserves_user_confirmed_edits(
    db_client: AsyncClient, db_session: AsyncSession, plaid_pages: list[Any]
) -> None:
    household_id, item = await _provision(db_client, db_session)
    plaid_pages.append(_page(added=[_plaid_tx("tx-3", 20.00, "AMZN Mktp")]))
    await sync_item(db_session, item)

    category = Category(household_id=household_id, name="Shopping Custom")
    db_session.add(category)
    await db_session.flush()
    category_id = category.id

    tx = await _get_tx(db_session, "tx-3")
    tx.is_user_confirmed = True
    tx.merchant_clean = "Amazon"
    tx.category_id = category_id
    await db_session.commit()

    # Plaid reports the transaction as modified (e.g. pending -> posted).
    plaid_pages.append(
        _page(
            modified=[_plaid_tx("tx-3", 21.37, "AMZN MKTP US*Z12", pending=False)],
            cursor="cursor-2",
        )
    )
    await sync_item(db_session, item)

    tx = await _get_tx(db_session, "tx-3")
    assert tx.merchant_clean == "Amazon"
    assert tx.category_id == category_id
    assert tx.is_user_confirmed is True
    # Bank stays authoritative for the money itself.
    assert tx.amount == Decimal("21.37")


async def test_sync_updates_unconfirmed_transactions(
    db_client: AsyncClient, db_session: AsyncSession, plaid_pages: list[Any]
) -> None:
    _, item = await _provision(db_client, db_session)
    plaid_pages.append(_page(added=[_plaid_tx("tx-4", 20.00, "Old Name")]))
    await sync_item(db_session, item)

    plaid_pages.append(
        _page(modified=[_plaid_tx("tx-4", 25.00, "New Name")], cursor="cursor-2")
    )
    await sync_item(db_session, item)

    tx = await _get_tx(db_session, "tx-4")
    assert tx.merchant_clean == "New Name"
    assert tx.amount == Decimal("25.00")


async def test_sync_soft_deletes_removed(
    db_client: AsyncClient, db_session: AsyncSession, plaid_pages: list[Any]
) -> None:
    _, item = await _provision(db_client, db_session)
    plaid_pages.append(_page(added=[_plaid_tx("tx-5", 5.00, "Duplicate")]))
    await sync_item(db_session, item)

    plaid_pages.append(_page(removed=["tx-5"], cursor="cursor-2"))
    log = await sync_item(db_session, item)

    assert log.removed_count == 1
    tx = await _get_tx(db_session, "tx-5")
    assert tx.is_deleted is True
    assert tx.deleted_at is not None


async def test_sync_failure_sets_error_and_keeps_cursor(
    db_client: AsyncClient, db_session: AsyncSession, plaid_pages: list[Any]
) -> None:
    _, item = await _provision(db_client, db_session)
    plaid_pages.append(_page(added=[_plaid_tx("tx-6", 10.00, "First Page")]))
    await sync_item(db_session, item)
    assert item.cursor == "cursor-1"

    plaid_pages.append(RuntimeError("plaid exploded"))
    log = await sync_item(db_session, item)

    assert log.error == "plaid exploded"
    assert log.completed_at is not None
    assert item.status == PlaidItemStatus.error
    # The committed cursor from the successful sync is untouched.
    assert item.cursor == "cursor-1"
    # Previously synced data survives the failed run.
    tx = await _get_tx(db_session, "tx-6")
    assert tx.is_deleted is False
