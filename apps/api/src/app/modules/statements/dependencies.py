from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.database import get_db
from app.modules.household.service import get_household_for_user
from app.modules.statements.models import Statement
from app.modules.statements.service import get_statement
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User


async def get_household_id(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    return household.id


async def get_statement_or_404(
    statement_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> Statement:
    statement = await get_statement(db, statement_id, household_id)
    if statement is None:
        raise NotFoundError("Statement not found")
    return statement
