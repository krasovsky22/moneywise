from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
