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


class PlaidItemStatus(StrEnum):
    good = "good"
    degraded = "degraded"
    login_required = "login_required"
    error = "error"


class PlaidSyncType(StrEnum):
    cron = "cron"
    manual = "manual"


class PlaidItem(Base):
    __tablename__ = "plaid_items"
    __table_args__ = (
        Index("idx_plaid_items_household_id", "household_id"),
        Index("idx_plaid_items_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    plaid_item_id: Mapped[str] = mapped_column(String(255), nullable=False)
    plaid_access_token: Mapped[str] = mapped_column(String(1024), nullable=False)
    plaid_institution_id: Mapped[str] = mapped_column(String(255), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution_logo_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True
    )
    institution_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cursor: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[PlaidItemStatus] = mapped_column(
        Enum(PlaidItemStatus, name="plaiditemstatus"),
        nullable=False,
        default=PlaidItemStatus.good,
        server_default="good",
    )
    error_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consent_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PlaidSyncLog(Base):
    __tablename__ = "plaid_sync_log"
    __table_args__ = (Index("idx_plaid_sync_log_plaid_item_id", "plaid_item_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    plaid_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("plaid_items.id", ondelete="CASCADE"), nullable=False
    )
    sync_type: Mapped[PlaidSyncType] = mapped_column(
        Enum(PlaidSyncType, name="plaidsynctype"),
        nullable=False,
        default=PlaidSyncType.manual,
        server_default="manual",
    )
    cursor_before: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cursor_after: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    added_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    modified_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    removed_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    error: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
