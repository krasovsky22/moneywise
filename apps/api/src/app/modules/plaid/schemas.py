from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class LinkTokenRequest(BaseModel):
    item_id: uuid.UUID | None = None


class LinkTokenResponse(BaseModel):
    link_token: str


class ExchangeTokenRequest(BaseModel):
    public_token: str
    institution_id: str
    institution_name: str


class PlaidAccountOut(BaseModel):
    id: uuid.UUID
    plaid_account_id: str | None
    nickname: str
    last4: str | None
    account_type: str
    subtype: str | None
    current_balance: Decimal | None
    available_balance: Decimal | None
    model_config = ConfigDict(from_attributes=True)


class PlaidItemOut(BaseModel):
    id: uuid.UUID
    institution_name: str
    institution_logo_url: str | None
    institution_color: str | None
    status: str
    last_synced_at: datetime | None
    accounts: list[PlaidAccountOut] = []
    model_config = ConfigDict(from_attributes=True)


class SyncQueuedResponse(BaseModel):
    queued: bool


class SyncResultResponse(BaseModel):
    added: int
    modified: int
    removed: int
