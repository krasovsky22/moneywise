from __future__ import annotations

import csv
import io
import math
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.database import get_db
from app.modules.categories.dependencies import get_household_id
from app.modules.transactions.models import Transaction, TransactionType
from app.modules.transactions.schemas import (
    BulkUpdateRequest,
    BulkUpdateResponse,
    MonthSummary,
    PaginatedTransactions,
    SoftDeleteResponse,
    SplitRequest,
    SplitResponse,
    TransactionCreate,
    TransactionDetailResponse,
    TransactionResponse,
    TransactionsSummaryResponse,
    TransactionUpdate,
)
from app.modules.transactions.service import (
    apply_sort,
    build_transactions_query,
    bulk_update,
    create_transaction,
    get_transaction,
    get_transaction_detail,
    list_transactions_global,
    restore_transaction,
    soft_delete,
    split_transaction,
    summarize_by_month,
    update_transaction,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(tags=["transactions"])


def _to_response(tx: Transaction) -> TransactionResponse:
    return TransactionResponse.model_validate(tx)


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
    bank_account_ids: Annotated[list[str], Query()] = [],  # noqa: B006
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
    parsed_bank_account_ids = [
        uuid.UUID(x) for x in _parse_list_param(bank_account_ids) if x
    ]
    parsed_cat_ids = _parse_list_param(category_ids)
    parsed_types = [
        TransactionType(t)
        for t in _parse_list_param(transaction_type)
        if t in TransactionType._value2member_map_
    ]

    stmt = build_transactions_query(
        household_id,
        q=q,
        date_from=date_from,
        date_to=date_to,
        card_ids=parsed_card_ids or None,
        bank_account_ids=parsed_bank_account_ids or None,
        category_ids=parsed_cat_ids or None,
        amount_min=amount_min,
        amount_max=amount_max,
        is_user_confirmed=is_user_confirmed,
        source=source,
        transaction_types=parsed_types or None,
    )
    stmt = apply_sort(stmt, sort_by, sort_order)

    today = datetime.now(UTC).strftime("%Y-%m-%d")

    async def generate() -> AsyncGenerator[str, None]:
        # The get_db session stays open while streaming: FastAPI runs
        # dependency teardown only after the response body is sent.
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

        result = await db.stream_scalars(stmt.execution_options(yield_per=500))
        async for tx in result:
            writer.writerow(
                [
                    tx.date.isoformat(),
                    str(tx.card_id) if tx.card_id else "",
                    tx.merchant_clean,
                    str(tx.amount),
                    str(tx.category_id) if tx.category_id else "",
                    tx.notes or "",
                    tx.source,
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
    "/transactions/summary",
    response_model=TransactionsSummaryResponse,
)
async def transactions_summary_route(
    date_from: Annotated[str, Query()],
    date_to: Annotated[str, Query()],
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionsSummaryResponse:
    try:
        parsed_from = date.fromisoformat(date_from)
        parsed_to = date.fromisoformat(date_to)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from and date_to must be ISO dates (YYYY-MM-DD)",
        ) from exc
    if parsed_from > parsed_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must be on or before date_to",
        )

    totals = await summarize_by_month(db, household_id, parsed_from, parsed_to)

    zero = Decimal("0")
    months: list[MonthSummary] = []
    cursor = date(parsed_from.year, parsed_from.month, 1)
    while cursor <= parsed_to:
        key = f"{cursor.year:04d}-{cursor.month:02d}"

        def amount_of(tx_type: TransactionType, *, _key: str = key) -> Decimal:
            return totals.get((_key, tx_type), (zero, 0))[0]

        income = amount_of(TransactionType.income)
        expense = amount_of(TransactionType.expense)
        refund = amount_of(TransactionType.refund)
        transfer = amount_of(TransactionType.transfer)
        count = sum(totals.get((key, t), (zero, 0))[1] for t in TransactionType)
        months.append(
            MonthSummary(
                month=key,
                income=income,
                expense=expense,
                refund=refund,
                transfer=transfer,
                net=income + refund - expense,
                transaction_count=count,
            )
        )
        cursor = (
            date(cursor.year + 1, 1, 1)
            if cursor.month == 12
            else date(cursor.year, cursor.month + 1, 1)
        )

    return TransactionsSummaryResponse(
        date_from=parsed_from,
        date_to=parsed_to,
        months=months,
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
    bank_account_ids: Annotated[list[str], Query()] = [],  # noqa: B006
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
    parsed_bank_account_ids = [
        uuid.UUID(x) for x in _parse_list_param(bank_account_ids) if x
    ]
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
        bank_account_ids=parsed_bank_account_ids or None,
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
