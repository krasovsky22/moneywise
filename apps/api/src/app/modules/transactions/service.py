from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.statements.models import Statement, StatementStatus
from app.modules.transactions.models import Transaction
from app.modules.transactions.schemas import TransactionUpdate


async def list_transactions(
    session: AsyncSession,
    statement_id: uuid.UUID,
    household_id: uuid.UUID,
) -> list[Transaction]:
    result = await session.execute(
        select(Transaction)
        .where(
            Transaction.statement_id == statement_id,
            Transaction.household_id == household_id,
        )
        .order_by(Transaction.date, Transaction.created_at)
    )
    return list(result.scalars().all())


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


async def update_transaction(
    session: AsyncSession,
    transaction: Transaction,
    update_data: TransactionUpdate,
) -> Transaction:
    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    transaction.updated_at = datetime.now(UTC)
    await session.flush()
    return transaction


async def confirm_statement_transactions(
    session: AsyncSession,
    statement_id: uuid.UUID,
    household_id: uuid.UUID,
) -> int:
    result = await session.execute(
        update(Transaction)
        .where(
            Transaction.statement_id == statement_id,
            Transaction.household_id == household_id,
        )
        .values(is_user_confirmed=True, updated_at=datetime.now(UTC))
        .returning(Transaction.id)
    )
    confirmed_ids = result.fetchall()
    count = len(confirmed_ids)

    stmt_result = await session.execute(
        select(Statement).where(
            Statement.id == statement_id,
            Statement.household_id == household_id,
        )
    )
    statement = stmt_result.scalar_one_or_none()
    if statement is not None:
        statement.status = StatementStatus.ready

    await session.flush()
    return count


async def bulk_insert_transactions(
    session: AsyncSession,
    transactions: list[dict[str, object]],
) -> list[Transaction]:
    objects = [Transaction(**tx) for tx in transactions]
    session.add_all(objects)
    await session.flush()
    return objects
