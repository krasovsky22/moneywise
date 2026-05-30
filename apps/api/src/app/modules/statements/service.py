from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import aiofiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.modules.statements.models import FailureReason, Statement, StatementStatus

STORAGE_BASE = Path("data/statements")


def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def get_storage_path(
    household_id: uuid.UUID, statement_id: uuid.UUID, filename: str
) -> Path:
    return STORAGE_BASE / str(household_id) / str(statement_id) / filename


async def save_file(path: Path, content: bytes) -> None:
    await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as f:
        await f.write(content)


async def find_duplicate(
    session: AsyncSession,
    household_id: uuid.UUID,
    file_hash: str,
) -> Statement | None:
    result = await session.execute(
        select(Statement).where(
            Statement.household_id == household_id,
            Statement.file_hash == file_hash,
        )
    )
    return result.scalar_one_or_none()


async def create_statement(
    session: AsyncSession,
    *,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    file_hash: str,
    storage_path: str,
    file_mime: str,
    file_size_bytes: int,
    file_original_name: str,
    card_id: uuid.UUID | None = None,
    bank_account_id: uuid.UUID | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
) -> Statement:
    statement = Statement(
        household_id=household_id,
        uploaded_by_user_id=user_id,
        file_hash=file_hash,
        file_storage_path=storage_path,
        file_mime=file_mime,
        file_size_bytes=file_size_bytes,
        file_original_name=file_original_name,
        card_id=card_id,
        bank_account_id=bank_account_id,
        period_start=period_start,
        period_end=period_end,
        status=StatementStatus.queued,
    )
    session.add(statement)
    await session.flush()
    return statement


async def list_statements(
    session: AsyncSession,
    household_id: uuid.UUID,
    status: StatementStatus | None = None,
    card_id: uuid.UUID | None = None,
    bank_account_id: uuid.UUID | None = None,
) -> list[Statement]:
    stmt = select(Statement).where(Statement.household_id == household_id)
    if status is not None:
        stmt = stmt.where(Statement.status == status)
    if card_id is not None:
        stmt = stmt.where(Statement.card_id == card_id)
    if bank_account_id is not None:
        stmt = stmt.where(Statement.bank_account_id == bank_account_id)
    stmt = stmt.order_by(Statement.uploaded_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_statement(
    session: AsyncSession,
    statement_id: uuid.UUID,
    household_id: uuid.UUID,
) -> Statement | None:
    result = await session.execute(
        select(Statement).where(
            Statement.id == statement_id,
            Statement.household_id == household_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_statement(
    session: AsyncSession,
    statement: Statement,
) -> None:
    # When Epic 06 adds the transactions table with source_statement_id FK + CASCADE,
    # linked transactions will be automatically deleted.
    await session.delete(statement)
    await session.flush()


async def update_statement_status(
    session: AsyncSession,
    statement: Statement,
    status: StatementStatus,
    failure_reason: FailureReason | None = None,
) -> Statement:
    statement.status = status
    if failure_reason is not None:
        statement.failure_reason = failure_reason
    if status in (StatementStatus.ready, StatementStatus.failed):
        statement.processed_at = datetime.now(UTC)
    await session.flush()
    return statement


async def process_statement_stub(statement_id: uuid.UUID) -> None:
    """Stub background processor — advances status to ready. Epic 04 replaces this."""
    await asyncio.sleep(2)
    async with AsyncSessionLocal() as session:
        statement = await session.get(Statement, statement_id)
        if statement is None:
            return
        statement.status = StatementStatus.parsing
        await session.commit()

    await asyncio.sleep(3)
    async with AsyncSessionLocal() as session:
        statement = await session.get(Statement, statement_id)
        if statement is None:
            return
        statement.status = StatementStatus.ready
        statement.processed_at = datetime.now(UTC)
        await session.commit()
