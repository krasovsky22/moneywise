from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.database import get_db
from app.modules.categories.dependencies import get_household_id
from app.modules.categories.schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryRuleCreate,
    CategoryRuleResponse,
)
from app.modules.categories.service import (
    create_category,
    create_rule,
    delete_category,
    delete_rule,
    delete_rule_by_merchant,
    list_categories,
    list_rules,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/categories", tags=["categories"])


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category_route(
    body: CategoryCreate,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    cat = await create_category(
        db,
        household_id=household_id,
        name=body.name,
        kind=body.kind,
        parent_id=body.parent_id,
        icon=body.icon,
        color=body.color,
    )
    return CategoryResponse.model_validate(cat)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category_route(
    category_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await delete_category(db, category_id, household_id)
    if not deleted:
        raise NotFoundError("Category not found or cannot be deleted")


@router.get("", response_model=list[CategoryResponse])
async def list_categories_route(
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryResponse]:
    categories = await list_categories(db, household_id)
    by_id: dict[uuid.UUID, CategoryResponse] = {}
    for cat in categories:
        by_id[cat.id] = CategoryResponse.model_validate(cat)
    roots: list[CategoryResponse] = []
    for cat in categories:
        node = by_id[cat.id]
        if cat.parent_id is not None and cat.parent_id in by_id:
            by_id[cat.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


@router.get("/rules", response_model=list[CategoryRuleResponse])
async def list_rules_route(
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryRuleResponse]:
    rules = await list_rules(db, household_id)
    return [CategoryRuleResponse.model_validate(r) for r in rules]


@router.post(
    "/rules",
    response_model=CategoryRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule_route(
    body: CategoryRuleCreate,
    household_id: uuid.UUID = Depends(get_household_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryRuleResponse:
    rule = await create_rule(
        db,
        household_id=household_id,
        user_id=current_user.id,
        pattern=body.pattern,
        category_id=body.category_id,
        match_type=body.match_type,
    )
    return CategoryRuleResponse.model_validate(rule)


@router.delete("/rules/by-merchant", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_by_merchant_route(
    pattern: str = Query(...),
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await delete_rule_by_merchant(db, household_id, pattern)
    if not deleted:
        raise NotFoundError("Rule not found")


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_route(
    rule_id: uuid.UUID,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await delete_rule(db, rule_id, household_id)
    if not deleted:
        raise NotFoundError("Rule not found")
