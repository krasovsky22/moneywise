from __future__ import annotations

import contextlib
import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.categories.service import upsert_rule
from app.modules.transactions.models import (
    ChangeKind,
    Transaction,
    TransactionAudit,
    TransactionType,
)
from app.modules.transactions.schemas import (
    SplitPart,
    TransactionCreate,
    TransactionUpdate,
)


def _tx_to_dict(tx: Transaction) -> dict[str, Any]:
    return {
        "date": tx.date.isoformat(),
        "amount": str(tx.amount),
        "merchant_clean": tx.merchant_clean,
        "merchant_raw": tx.merchant_raw,
        "transaction_type": tx.transaction_type,
        "category_id": str(tx.category_id) if tx.category_id else None,
        "notes": tx.notes,
        "is_user_confirmed": tx.is_user_confirmed,
        "is_deleted": tx.is_deleted,
    }


async def _record_audit(
    session: AsyncSession,
    transaction_id: uuid.UUID,
    user_id: uuid.UUID | None,
    change_kind: ChangeKind,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
) -> None:
    audit = TransactionAudit(
        transaction_id=transaction_id,
        changed_by_user_id=user_id,
        change_kind=change_kind,
        before_data=before_data,
        after_data=after_data,
    )
    session.add(audit)


async def get_transaction(
    session: AsyncSession,
    transaction_id: uuid.UUID,
    household_id: uuid.UUID,
) -> Transaction | None:
    result = await session.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.household_id == household_id,
        )
    )
    return result.scalar_one_or_none()


async def bulk_insert_transactions(
    session: AsyncSession,
    transactions: list[dict[str, object]],
) -> list[Transaction]:
    objects = [Transaction(**tx) for tx in transactions]
    session.add_all(objects)
    await session.flush()
    return objects


async def list_transactions_global(
    session: AsyncSession,
    household_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    card_ids: list[uuid.UUID] | None = None,
    bank_account_ids: list[uuid.UUID] | None = None,
    category_ids: list[str] | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    is_user_confirmed: bool | None = None,
    source: str | None = None,
    transaction_types: list[TransactionType] | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    include_deleted: bool = False,
) -> tuple[list[Transaction], int]:
    stmt = select(Transaction).where(Transaction.household_id == household_id)

    if not include_deleted:
        stmt = stmt.where(Transaction.is_deleted.is_(False))

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Transaction.merchant_clean.ilike(pattern) | Transaction.notes.ilike(pattern)
        )

    if date_from:
        from datetime import date as _date

        stmt = stmt.where(Transaction.date >= _date.fromisoformat(date_from))

    if date_to:
        from datetime import date as _date

        stmt = stmt.where(Transaction.date <= _date.fromisoformat(date_to))

    if card_ids:
        stmt = stmt.where(Transaction.card_id.in_(card_ids))

    if bank_account_ids:
        stmt = stmt.where(Transaction.bank_account_id.in_(bank_account_ids))

    if category_ids:
        conditions = []
        plain_ids: list[uuid.UUID] = []
        for cid in category_ids:
            if cid == "__uncategorized__":
                conditions.append(Transaction.category_id.is_(None))
            else:
                with contextlib.suppress(ValueError):
                    plain_ids.append(uuid.UUID(cid))
        if plain_ids:
            conditions.append(Transaction.category_id.in_(plain_ids))
        if conditions:
            from sqlalchemy import or_

            stmt = stmt.where(or_(*conditions))

    if amount_min is not None:
        stmt = stmt.where(Transaction.amount >= amount_min)

    if amount_max is not None:
        stmt = stmt.where(Transaction.amount <= amount_max)

    if is_user_confirmed is not None:
        stmt = stmt.where(Transaction.is_user_confirmed.is_(is_user_confirmed))

    if source is not None:
        stmt = stmt.where(Transaction.source == source)

    if transaction_types:
        stmt = stmt.where(Transaction.transaction_type.in_(transaction_types))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    sort_col = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "merchant_clean": Transaction.merchant_clean,
        "created_at": Transaction.created_at,
    }.get(sort_by, Transaction.date)

    if sort_order == "asc":
        stmt = stmt.order_by(sort_col.asc())
    else:
        stmt = stmt.order_by(sort_col.desc())

    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await session.execute(stmt)
    items = list(result.scalars().all())
    return items, total


async def get_transaction_detail(
    session: AsyncSession,
    transaction_id: uuid.UUID,
    household_id: uuid.UUID,
) -> tuple[Transaction | None, list[Transaction], list[TransactionAudit]]:
    tx = await get_transaction(session, transaction_id, household_id)
    if tx is None:
        return None, [], []

    children_result = await session.execute(
        select(Transaction).where(Transaction.parent_transaction_id == transaction_id)
    )
    children = list(children_result.scalars().all())

    audit_result = await session.execute(
        select(TransactionAudit)
        .where(TransactionAudit.transaction_id == transaction_id)
        .order_by(TransactionAudit.changed_at.desc())
    )
    audit_trail = list(audit_result.scalars().all())

    return tx, children, audit_trail


async def create_transaction(
    session: AsyncSession,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    data: TransactionCreate,
) -> Transaction:
    merchant_raw = data.merchant_raw or data.merchant_clean
    tx = Transaction(
        household_id=household_id,
        card_id=data.card_id,
        bank_account_id=data.bank_account_id,
        date=data.date,
        amount=data.amount,
        merchant_clean=data.merchant_clean,
        merchant_raw=merchant_raw,
        transaction_type=data.transaction_type,
        category_id=data.category_id,
        notes=data.notes,
        is_user_confirmed=True,
        is_low_confidence=False,
        source="manual",
    )
    session.add(tx)
    await session.flush()

    await _record_audit(
        session,
        tx.id,
        user_id,
        ChangeKind.created,
        after_data=_tx_to_dict(tx),
    )
    await session.flush()
    return tx


async def update_transaction(
    session: AsyncSession,
    transaction: Transaction,
    update_data: TransactionUpdate,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    create_rule: bool = True,
) -> Transaction:
    before = _tx_to_dict(transaction)
    changed_fields = update_data.model_dump(exclude_unset=True)

    for field, value in changed_fields.items():
        setattr(transaction, field, value)
    transaction.updated_at = datetime.now(UTC)
    await session.flush()

    only_category_changed = set(changed_fields.keys()) == {"category_id"}
    change_kind = ChangeKind.categorized if only_category_changed else ChangeKind.edited

    await _record_audit(
        session,
        transaction.id,
        user_id,
        change_kind,
        before_data=before,
        after_data=_tx_to_dict(transaction),
    )

    if create_rule and update_data.category_id is not None:
        await upsert_rule(
            session,
            household_id=household_id,
            user_id=user_id,
            pattern=transaction.merchant_clean,
            category_id=update_data.category_id,
        )

    await session.flush()
    return transaction


async def split_transaction(
    session: AsyncSession,
    transaction: Transaction,
    parts: list[SplitPart],
    user_id: uuid.UUID,
) -> tuple[Transaction, list[Transaction]]:
    two_places = Decimal("0.01")
    parts_total = sum(
        Decimal(str(p.amount)).quantize(two_places, rounding=ROUND_HALF_UP)
        for p in parts
    )
    parent_abs = abs(transaction.amount).quantize(two_places, rounding=ROUND_HALF_UP)

    if parts_total != parent_abs:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Split amounts sum ({parts_total}) must equal "
                f"abs(parent amount) ({parent_abs})"
            ),
        )

    before = _tx_to_dict(transaction)
    transaction.is_split = True
    transaction.updated_at = datetime.now(UTC)
    await session.flush()

    sign = Decimal("-1") if transaction.amount < Decimal("0") else Decimal("1")

    children: list[Transaction] = []
    for part in parts:
        child_amount = (
            Decimal(str(part.amount)).quantize(two_places, rounding=ROUND_HALF_UP)
            * sign
        )
        child = Transaction(
            household_id=transaction.household_id,
            card_id=transaction.card_id,
            bank_account_id=transaction.bank_account_id,
            date=transaction.date,
            amount=child_amount,
            merchant_clean=part.merchant_clean or transaction.merchant_clean,
            merchant_raw=transaction.merchant_raw,
            transaction_type=transaction.transaction_type,
            category_id=part.category_id,
            notes=part.notes,
            is_user_confirmed=True,
            is_low_confidence=False,
            parent_transaction_id=transaction.id,
            source=transaction.source,
        )
        session.add(child)
        children.append(child)

    await session.flush()

    await _record_audit(
        session,
        transaction.id,
        user_id,
        ChangeKind.split,
        before_data=before,
        after_data=_tx_to_dict(transaction),
    )
    await session.flush()
    return transaction, children


async def bulk_update(
    session: AsyncSession,
    ids: list[uuid.UUID],
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    category_id: uuid.UUID | None = None,
    transaction_type: TransactionType | None = None,
) -> int:
    if not ids:
        return 0

    result = await session.execute(
        select(Transaction).where(
            Transaction.id.in_(ids),
            Transaction.household_id == household_id,
        )
    )
    transactions = list(result.scalars().all())

    values: dict[str, Any] = {"updated_at": datetime.now(UTC)}
    if category_id is not None:
        values["category_id"] = category_id
    if transaction_type is not None:
        values["transaction_type"] = transaction_type

    for tx in transactions:
        before = _tx_to_dict(tx)
        for k, v in values.items():
            setattr(tx, k, v)
        only_category = category_id is not None and transaction_type is None
        change_kind = ChangeKind.categorized if only_category else ChangeKind.edited
        await _record_audit(
            session,
            tx.id,
            user_id,
            change_kind,
            before_data=before,
            after_data=_tx_to_dict(tx),
        )

    await session.flush()
    return len(transactions)


async def soft_delete(
    session: AsyncSession,
    transaction: Transaction,
    user_id: uuid.UUID,
) -> Transaction:
    before = _tx_to_dict(transaction)
    transaction.is_deleted = True
    transaction.deleted_at = datetime.now(UTC)
    transaction.updated_at = datetime.now(UTC)
    await session.flush()

    await _record_audit(
        session,
        transaction.id,
        user_id,
        ChangeKind.deleted,
        before_data=before,
        after_data=_tx_to_dict(transaction),
    )
    await session.flush()
    return transaction


async def restore_transaction(
    session: AsyncSession,
    transaction: Transaction,
    user_id: uuid.UUID,
) -> Transaction:
    before = _tx_to_dict(transaction)
    transaction.is_deleted = False
    transaction.deleted_at = None
    transaction.updated_at = datetime.now(UTC)
    await session.flush()

    await _record_audit(
        session,
        transaction.id,
        user_id,
        ChangeKind.undeleted,
        before_data=before,
        after_data=_tx_to_dict(transaction),
    )
    await session.flush()
    return transaction
