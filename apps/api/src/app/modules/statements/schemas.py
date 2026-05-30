from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.modules.statements.models import FailureReason, FileFormat, StatementStatus


class IssuerSchemaResponse(BaseModel):
    id: uuid.UUID
    issuer_name: str
    file_format: FileFormat
    column_fingerprint: str | None
    usage_count: int
    created_at: datetime
    model_config = {"from_attributes": True}


class StatementResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    card_id: uuid.UUID | None
    bank_account_id: uuid.UUID | None
    uploaded_by_user_id: uuid.UUID | None
    issuer_schema_id: uuid.UUID | None
    file_hash: str
    file_mime: str
    file_size_bytes: int
    file_original_name: str
    period_start: date | None
    period_end: date | None
    status: StatementStatus
    failure_reason: FailureReason | None
    uploaded_at: datetime
    processed_at: datetime | None
    ai_cost_cents: int | None
    model_config = {"from_attributes": True}


class StatementStatusResponse(BaseModel):
    id: uuid.UUID
    status: StatementStatus
    failure_reason: FailureReason | None
    uploaded_at: datetime
    processed_at: datetime | None
    model_config = {"from_attributes": True}


class StatementUploadResponse(BaseModel):
    """Wraps both normal upload and duplicate-detected responses."""

    duplicate: bool = False
    statement: StatementResponse | None = None
    existing_statement_id: uuid.UUID | None = None
    existing_uploaded_at: datetime | None = None
