from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    ARRAY,
    JSON,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StatementStatus(StrEnum):
    queued = "queued"
    parsing = "parsing"
    categorizing = "categorizing"
    needs_review = "needs_review"
    ready = "ready"
    failed = "failed"


class FailureReason(StrEnum):
    unreadable_pdf = "unreadable_pdf"
    encrypted = "encrypted"
    unsupported_format = "unsupported_format"
    parsing_error = "parsing_error"
    ai_unavailable = "ai_unavailable"


class FileFormat(StrEnum):
    pdf = "pdf"
    csv = "csv"


class IssuerSchema(Base):
    __tablename__ = "issuer_schemas"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    issuer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    file_format: Mapped[FileFormat] = mapped_column(
        Enum(FileFormat, name="fileformat"), nullable=False
    )
    column_fingerprint: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    column_mapping: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)
    raw_headers: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Statement(Base):
    __tablename__ = "statements"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    card_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    issuer_schema_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("issuer_schemas.id", ondelete="SET NULL"),
        nullable=True,
    )
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_mime: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[StatementStatus] = mapped_column(
        Enum(StatementStatus, name="statementstatus"),
        nullable=False,
        default=StatementStatus.queued,
    )
    failure_reason: Mapped[FailureReason | None] = mapped_column(
        Enum(FailureReason, name="failurereason"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ai_cost_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
