from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from pydantic import BaseModel

from app.modules.transactions.models import TransactionType


class TransactionResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    card_id: uuid.UUID | None
    bank_account_id: uuid.UUID | None
    date: dt.date
    amount: Decimal
    merchant_clean: str
    merchant_raw: str
    transaction_type: TransactionType
    category_id: uuid.UUID | None
    is_user_confirmed: bool
    is_low_confidence: bool
    notes: str | None
    is_split: bool
    parent_transaction_id: uuid.UUID | None
    is_deleted: bool
    deleted_at: dt.datetime | None
    created_at: dt.datetime
    updated_at: dt.datetime | None
    plaid_transaction_id: str | None = None
    plaid_raw_metadata: dict[str, Any] | None = None
    pending: bool = False
    source: str

    model_config = {"from_attributes": True}


class PaginatedTransactions(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionCreate(BaseModel):
    date: dt.date
    amount: Decimal
    merchant_clean: str
    merchant_raw: str = ""
    transaction_type: TransactionType = TransactionType.expense
    category_id: uuid.UUID | None = None
    card_id: uuid.UUID | None = None
    bank_account_id: uuid.UUID | None = None
    notes: str | None = None


class TransactionUpdate(BaseModel):
    date: dt.date | None = None
    amount: Decimal | None = None
    merchant_clean: str | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None
    transaction_type: TransactionType | None = None


class SplitPart(BaseModel):
    amount: Decimal
    merchant_clean: str | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class SplitRequest(BaseModel):
    parts: list[SplitPart]


class SplitResponse(BaseModel):
    parent: TransactionResponse
    children: list[TransactionResponse]


class BulkUpdateRequest(BaseModel):
    ids: list[uuid.UUID]
    category_id: uuid.UUID | None = None
    transaction_type: TransactionType | None = None


class BulkUpdateResponse(BaseModel):
    updated_count: int


class SoftDeleteResponse(BaseModel):
    deleted: bool
    deleted_at: dt.datetime
    undo_until: dt.datetime


class TransactionAuditResponse(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    changed_by_user_id: uuid.UUID | None
    changed_at: dt.datetime
    change_kind: str
    before_data: dict[str, Any] | None
    after_data: dict[str, Any] | None

    model_config = {"from_attributes": True}


class TransactionDetailResponse(TransactionResponse):
    children: list[TransactionResponse] = []
    audit_trail: list[TransactionAuditResponse] = []


class StatementConfirmResponse(BaseModel):
    confirmed_count: int
