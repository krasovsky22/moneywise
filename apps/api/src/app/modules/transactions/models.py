from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TransactionType(StrEnum):
    expense = "expense"
    income = "income"
    transfer = "transfer"
    refund = "refund"


class ChangeKind(StrEnum):
    created = "created"
    edited = "edited"
    categorized = "categorized"
    split = "split"  # type: ignore[assignment]
    deleted = "deleted"
    undeleted = "undeleted"


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index(
            "idx_transactions_household_date",
            "household_id",
            text("date DESC"),
        ),
        Index(
            "idx_transactions_household_is_deleted",
            "household_id",
            "is_deleted",
        ),
        Index(
            "idx_transactions_parent_id",
            "parent_transaction_id",
            postgresql_where=text("parent_transaction_id IS NOT NULL"),
        ),
        Index(
            "idx_transactions_search",
            text(
                "to_tsvector('english'::regconfig, (merchant_clean::text || ' '::text)"
                " || COALESCE(notes, ''::character varying)::text)"
            ),
            postgresql_using="gin",
        ),
        Index(
            "idx_transactions_plaid_transaction_id",
            "plaid_transaction_id",
            unique=True,
            postgresql_where=text("plaid_transaction_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    card_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    merchant_clean: Mapped[str] = mapped_column(String(500), nullable=False)
    merchant_raw: Mapped[str] = mapped_column(String(500), nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transactiontype"), nullable=False
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    is_user_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    is_low_confidence: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_split: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    parent_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    plaid_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plaid_raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="statement"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class TransactionAudit(Base):
    __tablename__ = "transaction_audits"
    __table_args__ = (Index("idx_transaction_audits_transaction_id", "transaction_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    change_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    before_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    after_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
