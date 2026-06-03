from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.bank_accounts.models import BankAccount
from app.modules.plaid.dependencies import get_current_plaid_item, get_household_id
from app.modules.plaid.models import PlaidItem, PlaidSyncType
from app.modules.plaid.schemas import (
    ExchangeTokenRequest,
    LinkTokenRequest,
    LinkTokenResponse,
    PlaidAccountOut,
    PlaidItemOut,
    SyncResultResponse,
)
from app.modules.plaid.service import (
    create_link_token,
    delete_item,
    exchange_and_provision,
    get_item_accounts,
    list_items,
)
from app.modules.plaid.sync import sync_item
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/plaid", tags=["plaid"])


@router.post("/link/token", response_model=LinkTokenResponse)
async def create_link_token_route(
    body: LinkTokenRequest = LinkTokenRequest(),
    current_user: User = Depends(get_current_user),
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> LinkTokenResponse:
    link_token = await create_link_token(
        db, current_user.id, household_id, body.item_id
    )
    return LinkTokenResponse(link_token=link_token)


async def _run_initial_sync(item_id: uuid.UUID, household_id: uuid.UUID) -> None:
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import select

            result = await db.execute(
                select(PlaidItem).where(
                    PlaidItem.id == item_id,
                    PlaidItem.household_id == household_id,
                )
            )
            item = result.scalar_one_or_none()
            if item is not None:
                await sync_item(db, item, PlaidSyncType.manual)
            await db.commit()
        except Exception:
            await db.rollback()


@router.post(
    "/items",
    response_model=PlaidItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def exchange_token_route(
    body: ExchangeTokenRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> PlaidItemOut:
    item = await exchange_and_provision(
        db,
        current_user.id,
        household_id,
        body.public_token,
        body.institution_id,
        body.institution_name,
    )
    accounts = await get_item_accounts(db, item.id)
    background_tasks.add_task(_run_initial_sync, item.id, household_id)
    return _build_item_out(item, accounts)


@router.get("/items", response_model=list[PlaidItemOut])
async def list_items_route(
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[PlaidItemOut]:
    items = await list_items(db, household_id)
    result: list[PlaidItemOut] = []
    for item in items:
        accounts = await get_item_accounts(db, item.id)
        result.append(_build_item_out(item, accounts))
    return result


@router.delete("/items/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item_route(
    plaid_item: PlaidItem = Depends(get_current_plaid_item),
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_item(db, plaid_item.id, household_id)


@router.post("/items/{id}/sync", response_model=SyncResultResponse)
async def sync_item_route(
    plaid_item: PlaidItem = Depends(get_current_plaid_item),
    db: AsyncSession = Depends(get_db),
) -> SyncResultResponse:
    log = await sync_item(db, plaid_item, PlaidSyncType.manual)
    await db.commit()
    return SyncResultResponse(
        added=log.added_count or 0,
        modified=log.modified_count or 0,
        removed=log.removed_count or 0,
    )


def _build_item_out(item: PlaidItem, accounts: list[BankAccount]) -> PlaidItemOut:
    return PlaidItemOut(
        id=item.id,
        institution_name=item.institution_name,
        institution_logo_url=item.institution_logo_url,
        institution_color=item.institution_color,
        status=item.status,
        last_synced_at=item.last_synced_at,
        accounts=[
            PlaidAccountOut(
                id=acct.id,
                plaid_account_id=acct.plaid_account_id,
                nickname=acct.nickname,
                last4=acct.last4,
                account_type=acct.account_type.value,
                subtype=acct.subtype,
                current_balance=acct.current_balance,
                available_balance=acct.available_balance,
            )
            for acct in accounts
        ],
    )
