from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.cards.models import CardNetwork


class CardCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=100)
    issuer: str = Field(min_length=1, max_length=100)
    last4: str = Field(min_length=4, max_length=4)
    network: CardNetwork | None = None
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=50)
    statement_close_day: int = Field(ge=1, le=31)
    payment_due_day: int = Field(ge=1, le=31)
    minimum_payment_cents: int | None = Field(default=None, ge=0)
    is_shared: bool = True
    is_default: bool = False


class CardUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=100)
    issuer: str | None = Field(default=None, min_length=1, max_length=100)
    last4: str | None = Field(default=None, min_length=4, max_length=4)
    network: CardNetwork | None = None
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=50)
    statement_close_day: int | None = Field(default=None, ge=1, le=31)
    payment_due_day: int | None = Field(default=None, ge=1, le=31)
    minimum_payment_cents: int | None = Field(default=None, ge=0)
    is_shared: bool | None = None
    is_default: bool | None = None


class CardResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    nickname: str
    issuer: str
    last4: str
    network: CardNetwork | None
    color: str | None
    icon: str | None
    statement_close_day: int
    payment_due_day: int
    minimum_payment_cents: int | None
    is_shared: bool
    is_default: bool
    is_archived: bool
    created_at: datetime
    archived_at: datetime | None

    model_config = {"from_attributes": True}
