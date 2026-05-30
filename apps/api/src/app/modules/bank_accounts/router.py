from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.bank_accounts.dependencies import (
    get_bank_account_or_404,
    get_household_id,
)
from app.modules.bank_accounts.models import BankAccount
from app.modules.bank_accounts.schemas import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
)
from app.modules.bank_accounts.service import (
    archive_bank_account,
    create_bank_account,
    list_bank_accounts,
    unarchive_bank_account,
    update_bank_account,
)

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])


@router.get("", response_model=list[BankAccountResponse])
async def list_bank_accounts_route(
    include_archived: bool = False,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[BankAccount]:
    return await list_bank_accounts(db, household_id, include_archived)


@router.post(
    "",
    response_model=BankAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bank_account_route(
    body: BankAccountCreate,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    return await create_bank_account(db, household_id, body)


@router.get("/{bank_account_id}", response_model=BankAccountResponse)
async def get_bank_account_route(
    bank_account: BankAccount = Depends(get_bank_account_or_404),
) -> BankAccount:
    return bank_account


@router.patch("/{bank_account_id}", response_model=BankAccountResponse)
async def update_bank_account_route(
    body: BankAccountUpdate,
    bank_account: BankAccount = Depends(get_bank_account_or_404),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    return await update_bank_account(db, bank_account, body)


@router.post("/{bank_account_id}/archive", response_model=BankAccountResponse)
async def archive_bank_account_route(
    bank_account: BankAccount = Depends(get_bank_account_or_404),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    return await archive_bank_account(db, bank_account)


@router.post("/{bank_account_id}/unarchive", response_model=BankAccountResponse)
async def unarchive_bank_account_route(
    bank_account: BankAccount = Depends(get_bank_account_or_404),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    return await unarchive_bank_account(db, bank_account)
