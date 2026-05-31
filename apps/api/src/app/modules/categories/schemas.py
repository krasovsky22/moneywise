from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.modules.categories.models import CategoryKind


class CategoryResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    name: str
    icon: str | None
    color: str | None
    is_system: bool
    kind: CategoryKind
    created_at: datetime
    children: list[CategoryResponse] = []

    model_config = {"from_attributes": True}


class CategoryRuleResponse(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    pattern: str
    match_type: str
    category_id: uuid.UUID
    created_by_user_id: uuid.UUID | None
    created_at: datetime
    hit_count: int
    last_applied_at: datetime | None

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None
    icon: str | None = None
    color: str | None = None
    kind: CategoryKind = CategoryKind.spending


class CategoryRuleCreate(BaseModel):
    pattern: str
    category_id: uuid.UUID
    match_type: str = "substring"
