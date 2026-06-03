from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CardNetwork(StrEnum):
    visa = "visa"
    mastercard = "mastercard"
    amex = "amex"
    discover = "discover"
    other = "other"


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        Index("ix_cards_household_id", "household_id"),
        Index("idx_cards_plaid_account_id", "plaid_account_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    issuer: Mapped[str] = mapped_column(String(100), nullable=False)
    last4: Mapped[str] = mapped_column(String(4), nullable=False)
    network: Mapped[CardNetwork | None] = mapped_column(
        Enum(CardNetwork, name="cardnetwork"),
        nullable=True,
    )
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    statement_close_day: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    minimum_payment_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    plaid_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
