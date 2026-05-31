from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.database import get_db
from app.modules.categories.dependencies import get_household_id
from app.modules.transactions.models import Transaction
from app.modules.transactions.schemas import (
    StatementConfirmResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.modules.transactions.service import (
    confirm_statement_transactions,
    get_transaction,
    list_transactions,
    update_transaction,
)

router = APIRouter(tags=["transactions"])


@router.get(
    "/statements/{statement_id}/transactions",
    response_model=list[TransactionResponse],
)
async def list_transactions_route(
    statement_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[Transaction]:
    return await list_transactions(db, statement_id, household_id)


@router.patch(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
)
async def update_transaction_route(
    transaction_id: uuid.UUID,
    body: TransactionUpdate,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    transaction = await get_transaction(db, transaction_id, household_id)
    if transaction is None:
        raise NotFoundError("Transaction not found")
    return await update_transaction(db, transaction, body)


@router.post(
    "/statements/{statement_id}/confirm",
    response_model=StatementConfirmResponse,
    status_code=status.HTTP_200_OK,
)
async def confirm_statement_route(
    statement_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> StatementConfirmResponse:
    count = await confirm_statement_transactions(db, statement_id, household_id)
    return StatementConfirmResponse(confirmed_count=count)
