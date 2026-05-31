from __future__ import annotations

import csv
import io
import math
import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.database import get_db
from app.modules.categories.dependencies import get_household_id
from app.modules.transactions.models import Transaction, TransactionType
from app.modules.transactions.schemas import (
    BulkUpdateRequest,
    BulkUpdateResponse,
    PaginatedTransactions,
    SoftDeleteResponse,
    SplitRequest,
    SplitResponse,
    StatementConfirmResponse,
    TransactionCreate,
    TransactionDetailResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.modules.transactions.service import (
    _source_for,
    bulk_update,
    confirm_statement_transactions,
    create_transaction,
    get_transaction,
    get_transaction_detail,
    list_transactions,
    list_transactions_global,
    restore_transaction,
    soft_delete,
    split_transaction,
    update_transaction,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(tags=["transactions"])


def _to_response(tx: Transaction) -> TransactionResponse:
    data = {
        "id": tx.id,
        "statement_id": tx.statement_id,
        "household_id": tx.household_id,
        "card_id": tx.card_id,
        "bank_account_id": tx.bank_account_id,
        "date": tx.date,
        "amount": tx.amount,
        "merchant_clean": tx.merchant_clean,
        "merchant_raw": tx.merchant_raw,
        "transaction_type": tx.transaction_type,
        "category_id": tx.category_id,
        "confidence_date": tx.confidence_date,
        "confidence_amount": tx.confidence_amount,
        "confidence_merchant": tx.confidence_merchant,
        "confidence_category": tx.confidence_category,
        "is_user_confirmed": tx.is_user_confirmed,
        "is_low_confidence": tx.is_low_confidence,
        "notes": tx.notes,
        "is_split": tx.is_split,
        "parent_transaction_id": tx.parent_transaction_id,
        "is_deleted": tx.is_deleted,
        "deleted_at": tx.deleted_at,
        "created_at": tx.created_at,
        "updated_at": tx.updated_at,
        "source": _source_for(tx),
    }
    return TransactionResponse.model_validate(data)


# ---------------------------------------------------------------------------
# Existing endpoints (backwards compat)
# ---------------------------------------------------------------------------


@router.get(
    "/statements/{statement_id}/transactions",
    response_model=list[TransactionResponse],
)
async def list_transactions_route(
    statement_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[TransactionResponse]:
    txs = await list_transactions(db, statement_id, household_id)
    return [_to_response(tx) for tx in txs]


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


# ---------------------------------------------------------------------------
# New endpoints
# ---------------------------------------------------------------------------


def _parse_list_param(value: list[str]) -> list[str]:
    """Expand comma-separated items within each element."""
    result: list[str] = []
    for item in value:
        for part in item.split(","):
            part = part.strip()
            if part:
                result.append(part)
    return result


@router.get("/transactions/export")
async def export_transactions_csv(
    q: Annotated[str | None, Query()] = None,
    date_from: Annotated[str | None, Query()] = None,
    date_to: Annotated[str | None, Query()] = None,
    card_ids: Annotated[list[str], Query()] = [],  # noqa: B006
    category_ids: Annotated[list[str], Query()] = [],  # noqa: B006
    amount_min: Annotated[Decimal | None, Query()] = None,
    amount_max: Annotated[Decimal | None, Query()] = None,
    is_user_confirmed: Annotated[bool | None, Query()] = None,
    source: Annotated[str | None, Query()] = None,
    transaction_type: Annotated[list[str], Query()] = [],  # noqa: B006
    sort_by: Annotated[str, Query()] = "date",
    sort_order: Annotated[str, Query()] = "desc",
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    parsed_card_ids = [uuid.UUID(x) for x in _parse_list_param(card_ids) if x]
    parsed_cat_ids = _parse_list_param(category_ids)
    parsed_types = [
        TransactionType(t)
        for t in _parse_list_param(transaction_type)
        if t in TransactionType._value2member_map_
    ]

    items, _ = await list_transactions_global(
        session=db,
        household_id=household_id,
        page=1,
        page_size=100_000,
        q=q,
        date_from=date_from,
        date_to=date_to,
        card_ids=parsed_card_ids or None,
        category_ids=parsed_cat_ids or None,
        amount_min=amount_min,
        amount_max=amount_max,
        is_user_confirmed=is_user_confirmed,
        source=source,
        transaction_types=parsed_types or None,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    today = datetime.now(UTC).strftime("%Y-%m-%d")

    def generate() -> Generator[str, None, None]:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "date",
                "card",
                "merchant",
                "amount",
                "category",
                "notes",
                "source",
                "type",
            ]
        )
        yield output.getvalue()
        output.truncate(0)
        output.seek(0)

        for tx in items:
            writer.writerow(
                [
                    tx.date.isoformat(),
                    str(tx.card_id) if tx.card_id else "",
                    tx.merchant_clean,
                    str(tx.amount),
                    str(tx.category_id) if tx.category_id else "",
                    tx.notes or "",
                    _source_for(tx),
                    tx.transaction_type,
                ]
            )
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="transactions-{today}.csv"'
        },
    )


@router.get(
    "/transactions",
    response_model=PaginatedTransactions,
)
async def list_transactions_global_route(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    q: Annotated[str | None, Query()] = None,
    date_from: Annotated[str | None, Query()] = None,
    date_to: Annotated[str | None, Query()] = None,
    card_ids: Annotated[list[str], Query()] = [],  # noqa: B006
    category_ids: Annotated[list[str], Query()] = [],  # noqa: B006
    amount_min: Annotated[Decimal | None, Query()] = None,
    amount_max: Annotated[Decimal | None, Query()] = None,
    is_user_confirmed: Annotated[bool | None, Query()] = None,
    source: Annotated[str | None, Query()] = None,
    transaction_type: Annotated[list[str], Query()] = [],  # noqa: B006
    sort_by: Annotated[str, Query()] = "date",
    sort_order: Annotated[str, Query()] = "desc",
    include_deleted: Annotated[bool, Query()] = False,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> PaginatedTransactions:
    parsed_card_ids = [uuid.UUID(x) for x in _parse_list_param(card_ids) if x]
    parsed_cat_ids = _parse_list_param(category_ids)
    parsed_types = [
        TransactionType(t)
        for t in _parse_list_param(transaction_type)
        if t in TransactionType._value2member_map_
    ]

    items, total = await list_transactions_global(
        session=db,
        household_id=household_id,
        page=page,
        page_size=page_size,
        q=q,
        date_from=date_from,
        date_to=date_to,
        card_ids=parsed_card_ids or None,
        category_ids=parsed_cat_ids or None,
        amount_min=amount_min,
        amount_max=amount_max,
        is_user_confirmed=is_user_confirmed,
        source=source,
        transaction_types=parsed_types or None,
        sort_by=sort_by,
        sort_order=sort_order,
        include_deleted=include_deleted,
    )

    return PaginatedTransactions(
        items=[_to_response(tx) for tx in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionDetailResponse,
)
async def get_transaction_detail_route(
    transaction_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionDetailResponse:
    tx, children, audit_trail = await get_transaction_detail(
        db, transaction_id, household_id
    )
    if tx is None:
        raise NotFoundError("Transaction not found")

    from app.modules.transactions.schemas import TransactionAuditResponse

    return TransactionDetailResponse(
        **_to_response(tx).model_dump(),
        children=[_to_response(c) for c in children],
        audit_trail=[TransactionAuditResponse.model_validate(a) for a in audit_trail],
    )


@router.post(
    "/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction_route(
    body: TransactionCreate,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    tx = await create_transaction(db, household_id, current_user.id, body)
    return _to_response(tx)


@router.patch(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
)
async def update_transaction_route(
    transaction_id: uuid.UUID,
    body: TransactionUpdate,
    create_rule: bool = True,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await get_transaction(db, transaction_id, household_id)
    if transaction is None:
        raise NotFoundError("Transaction not found")
    tx = await update_transaction(
        db,
        transaction,
        body,
        household_id=household_id,
        user_id=current_user.id,
        create_rule=create_rule,
    )
    return _to_response(tx)


@router.post(
    "/transactions/{transaction_id}/split",
    response_model=SplitResponse,
    status_code=status.HTTP_200_OK,
)
async def split_transaction_route(
    transaction_id: uuid.UUID,
    body: SplitRequest,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SplitResponse:
    if len(body.parts) < 2:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Split requires at least 2 parts",
        )
    transaction = await get_transaction(db, transaction_id, household_id)
    if transaction is None:
        raise NotFoundError("Transaction not found")
    parent, children = await split_transaction(
        db, transaction, body.parts, current_user.id
    )
    return SplitResponse(
        parent=_to_response(parent),
        children=[_to_response(c) for c in children],
    )


@router.post(
    "/transactions/bulk-update",
    response_model=BulkUpdateResponse,
    status_code=status.HTTP_200_OK,
)
async def bulk_update_route(
    body: BulkUpdateRequest,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BulkUpdateResponse:
    count = await bulk_update(
        db,
        ids=body.ids,
        household_id=household_id,
        user_id=current_user.id,
        category_id=body.category_id,
        transaction_type=body.transaction_type,
    )
    return BulkUpdateResponse(updated_count=count)


@router.delete(
    "/transactions/{transaction_id}",
    response_model=SoftDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_transaction_route(
    transaction_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SoftDeleteResponse:
    transaction = await get_transaction(db, transaction_id, household_id)
    if transaction is None:
        raise NotFoundError("Transaction not found")
    tx = await soft_delete(db, transaction, current_user.id)
    deleted_at = tx.deleted_at or datetime.now(UTC)
    return SoftDeleteResponse(
        deleted=True,
        deleted_at=deleted_at,
        undo_until=deleted_at + timedelta(days=7),
    )


@router.post(
    "/transactions/{transaction_id}/restore",
    response_model=TransactionResponse,
    status_code=status.HTTP_200_OK,
)
async def restore_transaction_route(
    transaction_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    transaction = await get_transaction(db, transaction_id, household_id)
    if transaction is None:
        raise NotFoundError("Transaction not found")
    tx = await restore_transaction(db, transaction, current_user.id)
    return _to_response(tx)
