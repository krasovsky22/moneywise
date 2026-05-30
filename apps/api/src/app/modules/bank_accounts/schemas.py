from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.modules.bank_accounts.models import AccountType


class BankAccountCreate(BaseModel):
    nickname: str = Field(min_length=1, max_length=100)
    institution: str = Field(min_length=1, max_length=100)
    account_type: AccountType
    last4: str | None = Field(default=None, min_length=4, max_length=4)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=50)
    is_shared: bool = True

    @field_validator("last4")
    @classmethod
    def last4_must_be_digits(cls, v: str | None) -> str | None:
        if v is not None and not v.isdigit():
            raise ValueError("last4 must contain exactly 4 digits")
        return v


class BankAccountUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=100)
    institution: str | None = Field(default=None, min_length=1, max_length=100)
    account_type: AccountType | None = None
    last4: str | None = Field(default=None, min_length=4, max_length=4)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=50)
    is_shared: bool | None = None

    @field_validator("last4")
    @classmethod
    def last4_must_be_digits(cls, v: str | None) -> str | None:
        if v is not None and not v.isdigit():
            raise ValueError("last4 must contain exactly 4 digits")
        return v


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    nickname: str
    institution: str
    account_type: AccountType
    last4: str | None
    color: str | None
    icon: str | None
    is_shared: bool
    is_archived: bool
    created_at: datetime
    archived_at: datetime | None

    model_config = {"from_attributes": True}
