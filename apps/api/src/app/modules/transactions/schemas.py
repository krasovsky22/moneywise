from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.modules.transactions.models import TransactionType


class TransactionResponse(BaseModel):
    id: uuid.UUID
    statement_id: uuid.UUID
    household_id: uuid.UUID
    card_id: uuid.UUID | None
    bank_account_id: uuid.UUID | None
    date: dt.date
    amount: Decimal
    merchant_clean: str
    merchant_raw: str
    transaction_type: TransactionType
    category_id: uuid.UUID | None
    confidence_date: float | None
    confidence_amount: float | None
    confidence_merchant: float | None
    confidence_category: float | None
    is_user_confirmed: bool
    is_low_confidence: bool
    notes: str | None
    created_at: dt.datetime
    updated_at: dt.datetime | None

    model_config = {"from_attributes": True}


class TransactionUpdate(BaseModel):
    date: dt.date | None = None
    amount: Decimal | None = None
    merchant_clean: str | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class StatementConfirmResponse(BaseModel):
    confirmed_count: int
