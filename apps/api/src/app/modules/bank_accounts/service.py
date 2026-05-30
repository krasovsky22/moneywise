from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.bank_accounts.models import BankAccount
from app.modules.bank_accounts.schemas import BankAccountCreate, BankAccountUpdate


async def list_bank_accounts(
    session: AsyncSession,
    household_id: uuid.UUID,
    include_archived: bool = False,
) -> list[BankAccount]:
    stmt = select(BankAccount).where(BankAccount.household_id == household_id)
    if not include_archived:
        stmt = stmt.where(BankAccount.is_archived.is_(False))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_bank_account(
    session: AsyncSession,
    bank_account_id: uuid.UUID,
    household_id: uuid.UUID,
) -> BankAccount | None:
    result = await session.execute(
        select(BankAccount).where(
            BankAccount.id == bank_account_id,
            BankAccount.household_id == household_id,
        )
    )
    return result.scalar_one_or_none()


async def create_bank_account(
    session: AsyncSession,
    household_id: uuid.UUID,
    data: BankAccountCreate,
) -> BankAccount:
    bank_account = BankAccount(
        household_id=household_id,
        nickname=data.nickname,
        institution=data.institution,
        account_type=data.account_type,
        last4=data.last4,
        color=data.color,
        icon=data.icon,
        is_shared=data.is_shared,
    )
    session.add(bank_account)
    await session.flush()
    return bank_account


async def update_bank_account(
    session: AsyncSession,
    bank_account: BankAccount,
    data: BankAccountUpdate,
) -> BankAccount:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bank_account, field, value)
    await session.flush()
    return bank_account


async def archive_bank_account(
    session: AsyncSession,
    bank_account: BankAccount,
) -> BankAccount:
    bank_account.is_archived = True
    bank_account.archived_at = datetime.now(UTC)
    await session.flush()
    return bank_account


async def unarchive_bank_account(
    session: AsyncSession,
    bank_account: BankAccount,
) -> BankAccount:
    bank_account.is_archived = False
    bank_account.archived_at = None
    await session.flush()
    return bank_account
