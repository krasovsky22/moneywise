from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.modules.bank_accounts.models import AccountType, BankAccount
from app.modules.household.models import Household
from app.modules.plaid import client as plaid_client
from app.modules.plaid.crypto import decrypt_token, encrypt_token
from app.modules.plaid.models import PlaidItem, PlaidItemStatus


async def _household_sandbox_flag(db: AsyncSession, household_id: uuid.UUID) -> bool:
    result = await db.execute(select(Household).where(Household.id == household_id))
    hh = result.scalar_one_or_none()
    return hh.is_plaid_sandbox if hh is not None else True


async def create_link_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    household_id: uuid.UUID,
    item_id: uuid.UUID | None = None,
) -> str:
    access_token: str | None = None
    if item_id is not None:
        result = await db.execute(
            select(PlaidItem).where(
                PlaidItem.id == item_id,
                PlaidItem.household_id == household_id,
                PlaidItem.is_deleted.is_(False),
            )
        )
        item = result.scalar_one_or_none()
        if item is None:
            raise NotFoundError("Plaid item not found")
        access_token = decrypt_token(item.plaid_access_token)

    is_sandbox = await _household_sandbox_flag(db, household_id)
    link_token = await asyncio.to_thread(
        plaid_client.create_link_token,
        str(user_id),
        str(household_id),
        access_token,
        is_sandbox,
    )
    return link_token


async def exchange_and_provision(
    db: AsyncSession,
    user_id: uuid.UUID,
    household_id: uuid.UUID,
    public_token: str,
    institution_id: str,
    institution_name: str,
) -> PlaidItem:
    is_sandbox = await _household_sandbox_flag(db, household_id)
    raw_access_token, plaid_item_id = await asyncio.to_thread(
        plaid_client.exchange_public_token, public_token, is_sandbox
    )

    institution_data = await asyncio.to_thread(
        plaid_client.get_institution, institution_id, is_sandbox
    )

    encrypted_token = encrypt_token(raw_access_token)

    item = PlaidItem(
        household_id=household_id,
        user_id=user_id,
        plaid_item_id=plaid_item_id,
        plaid_access_token=encrypted_token,
        plaid_institution_id=institution_id,
        institution_name=institution_data.get("name") or institution_name,
        institution_logo_url=institution_data.get("logo"),
        institution_color=institution_data.get("primary_color"),
        status=PlaidItemStatus.good,
    )
    db.add(item)
    await db.flush()

    raw_accounts = await asyncio.to_thread(
        plaid_client.get_accounts, raw_access_token, is_sandbox
    )

    for acct in raw_accounts:
        mask = acct.get("mask")
        acct_type = acct.get("type", "other")
        subtype = acct.get("subtype", "")

        if acct_type == "credit":
            mapped_type = AccountType.credit
        elif acct_type == "depository":
            if subtype in ("checking",):
                mapped_type = AccountType.checking
            elif subtype in ("savings",):
                mapped_type = AccountType.savings
            elif subtype in ("money market",):
                mapped_type = AccountType.money_market
            else:
                mapped_type = AccountType.checking
        else:
            mapped_type = AccountType.other

        plaid_acct_id_str: str = acct["account_id"]

        existing_result = await db.execute(
            select(BankAccount).where(
                BankAccount.household_id == household_id,
                BankAccount.plaid_account_id == plaid_acct_id_str,
            )
        )
        existing_bank = existing_result.scalars().first()

        if existing_bank is not None:
            existing_bank.plaid_item_id = item.id
            existing_bank.official_name = acct.get("official_name")
            existing_bank.subtype = acct.get("subtype")
            existing_bank.current_balance = acct.get("current_balance")
            existing_bank.available_balance = acct.get("available_balance")
            existing_bank.credit_limit = acct.get("credit_limit")
            existing_bank.currency_code = acct.get("currency_code") or "USD"
            existing_bank.is_active = True
        else:
            linked_bank: BankAccount | None = None
            if mask:
                match_result = await db.execute(
                    select(BankAccount).where(
                        BankAccount.household_id == household_id,
                        BankAccount.last4 == mask,
                        BankAccount.plaid_account_id.is_(None),
                        BankAccount.is_archived.is_(False),
                    )
                )
                linked_bank = match_result.scalars().first()

            if linked_bank is not None:
                linked_bank.plaid_account_id = plaid_acct_id_str
                linked_bank.plaid_item_id = item.id
                linked_bank.official_name = acct.get("official_name")
                linked_bank.subtype = acct.get("subtype")
                linked_bank.current_balance = acct.get("current_balance")
                linked_bank.available_balance = acct.get("available_balance")
                linked_bank.credit_limit = acct.get("credit_limit")
                linked_bank.currency_code = acct.get("currency_code") or "USD"
                linked_bank.is_active = True
            else:
                new_account = BankAccount(
                    household_id=household_id,
                    nickname=acct.get("official_name") or acct["name"],
                    institution=item.institution_name,
                    account_type=mapped_type,
                    last4=mask,
                    plaid_account_id=plaid_acct_id_str,
                    plaid_item_id=item.id,
                    official_name=acct.get("official_name"),
                    subtype=acct.get("subtype"),
                    current_balance=acct.get("current_balance"),
                    available_balance=acct.get("available_balance"),
                    credit_limit=acct.get("credit_limit"),
                    currency_code=acct.get("currency_code") or "USD",
                    is_active=True,
                    is_shared=True,
                )
                db.add(new_account)

    await db.flush()
    return item


async def list_items(
    db: AsyncSession,
    household_id: uuid.UUID,
) -> list[PlaidItem]:
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.household_id == household_id,
            PlaidItem.is_deleted.is_(False),
        )
    )
    return list(result.scalars().all())


async def get_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    household_id: uuid.UUID,
) -> PlaidItem:
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == item_id,
            PlaidItem.household_id == household_id,
            PlaidItem.is_deleted.is_(False),
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise NotFoundError("Plaid item not found")
    return item


async def delete_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    household_id: uuid.UUID,
) -> None:
    item = await get_item(db, item_id, household_id)
    access_token = decrypt_token(item.plaid_access_token)
    is_sandbox = await _household_sandbox_flag(db, item.household_id)
    await asyncio.to_thread(plaid_client.remove_item, access_token, is_sandbox)
    item.is_deleted = True
    item.updated_at = datetime.now(UTC)
    await db.flush()


async def get_item_accounts(
    db: AsyncSession,
    item_id: uuid.UUID,
) -> list[BankAccount]:
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.plaid_item_id == item_id,
            BankAccount.is_active.is_(True),
        )
    )
    return list(result.scalars().all())
