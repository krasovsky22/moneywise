from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.subscriptions.models import (
    SubscriptionFrequency,
    SubscriptionSource,
    SubscriptionStatus,
)


class SubscriptionCreate(BaseModel):
    merchant_clean: str = Field(min_length=1, max_length=500)
    amount_typical: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    frequency: SubscriptionFrequency
    next_expected_charge_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)


class SubscriptionUpdate(BaseModel):
    merchant_clean: str | None = Field(default=None, min_length=1, max_length=500)
    amount_typical: Decimal | None = Field(
        default=None, gt=0, max_digits=12, decimal_places=2
    )
    frequency: SubscriptionFrequency | None = None
    status: SubscriptionStatus | None = None
    next_expected_charge_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    merchant_clean: str
    amount_typical: Decimal
    currency: str
    frequency: SubscriptionFrequency
    anchor_day: int | None
    status: SubscriptionStatus
    next_expected_charge_date: date | None
    first_seen_at: date | None
    last_seen_at: date | None
    notes: str | None
    source: SubscriptionSource
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class SubscriptionChargeResponse(BaseModel):
    id: uuid.UUID
    subscription_id: uuid.UUID
    transaction_id: uuid.UUID
    occurred_on: date
    amount: Decimal
    deviation_from_typical: Decimal

    model_config = {"from_attributes": True}


class DetectionRunResponse(BaseModel):
    created: int
    updated: int
    charges_linked: int
