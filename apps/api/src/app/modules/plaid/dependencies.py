from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.database import get_db
from app.modules.household.service import get_household_for_user
from app.modules.plaid.models import PlaidItem
from app.modules.plaid.service import get_item
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


async def get_current_plaid_item(
    id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> PlaidItem:
    return await get_item(db, id, household_id)
