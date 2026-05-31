from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.statements.dependencies import (
    get_household_id,
    get_statement_or_404,
)
from app.modules.statements.models import Statement, StatementStatus
from app.modules.statements.schemas import (
    StatementResponse,
    StatementStatusResponse,
    StatementUploadResponse,
)
from app.modules.statements.service import (
    compute_file_hash,
    create_statement,
    delete_statement,
    delete_statement_transactions,
    find_duplicate,
    get_storage_path,
    list_statements,
    process_statement,
    save_file,
    update_statement_status,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/statements", tags=["statements"])

ALLOWED_MIME_TYPES = {"application/pdf", "text/csv", "application/csv"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post(
    "",
    response_model=StatementUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_statement(
    file: UploadFile,
    account_type: Annotated[Literal["card", "bank_account"], Form()],
    account_id: Annotated[uuid.UUID, Form()],
    background_tasks: BackgroundTasks,
    period_start: Annotated[date | None, Form()] = None,
    period_end: Annotated[date | None, Form()] = None,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatementUploadResponse:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported file type '{file.content_type}'."
                " Only PDF and CSV are accepted."
            ),
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail="File exceeds the 25 MB limit.",
        )

    file_hash = compute_file_hash(file_bytes)
    duplicate = await find_duplicate(db, household_id, file_hash)
    if duplicate is not None:
        return StatementUploadResponse(
            duplicate=True,
            existing_statement_id=duplicate.id,
            existing_uploaded_at=duplicate.uploaded_at,
        )

    card_id = account_id if account_type == "card" else None
    bank_account_id = account_id if account_type == "bank_account" else None
    original_name = file.filename or "statement"

    # Create DB record first to get the Postgres-generated UUID
    statement = await create_statement(
        db,
        household_id=household_id,
        user_id=current_user.id,
        file_hash=file_hash,
        storage_path="",  # placeholder; updated below after we know statement.id
        file_mime=file.content_type or "application/octet-stream",
        file_size_bytes=len(file_bytes),
        file_original_name=original_name,
        card_id=card_id,
        bank_account_id=bank_account_id,
        period_start=period_start,
        period_end=period_end,
    )

    storage_path = get_storage_path(household_id, statement.id, original_name)
    await save_file(storage_path, file_bytes)
    statement.file_storage_path = str(storage_path)
    await db.flush()

    # Commit now so the background task and the frontend's refetch both see the record.
    # get_db will commit again on exit (no-op since already committed).
    await db.commit()
    background_tasks.add_task(process_statement, statement.id)
    return StatementUploadResponse(
        duplicate=False,
        statement=StatementResponse.model_validate(statement),
    )


@router.get("", response_model=list[StatementResponse])
async def list_statements_route(
    status: StatementStatus | None = None,
    card_id: uuid.UUID | None = None,
    bank_account_id: uuid.UUID | None = None,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[Statement]:
    return await list_statements(
        db,
        household_id,
        status=status,
        card_id=card_id,
        bank_account_id=bank_account_id,
    )


@router.get("/{statement_id}", response_model=StatementResponse)
async def get_statement_route(
    statement: Statement = Depends(get_statement_or_404),
) -> Statement:
    return statement


@router.get("/{statement_id}/status", response_model=StatementStatusResponse)
async def get_statement_status_route(
    statement: Statement = Depends(get_statement_or_404),
) -> Statement:
    return statement


@router.delete("/{statement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_statement_route(
    statement: Statement = Depends(get_statement_or_404),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_statement(db, statement)


@router.post("/{statement_id}/reprocess", response_model=StatementResponse)
async def reprocess_statement_route(
    background_tasks: BackgroundTasks,
    statement: Statement = Depends(get_statement_or_404),
    db: AsyncSession = Depends(get_db),
) -> Statement:
    if statement.status in (
        StatementStatus.queued,
        StatementStatus.parsing,
        StatementStatus.categorizing,
    ):
        raise HTTPException(
            status_code=422,
            detail="Statement is already being processed.",
        )
    await delete_statement_transactions(db, statement.id)
    updated = await update_statement_status(db, statement, StatementStatus.queued)
    await db.commit()
    background_tasks.add_task(process_statement, updated.id)
    return updated
