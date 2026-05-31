from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.modules.household.models import HouseholdMemberRole, InvitationStatus


class HouseholdResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HouseholdMemberResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    display_name: str | None
    role: HouseholdMemberRole
    joined_at: datetime

    model_config = {"from_attributes": True}


class UpdateHouseholdRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class InviteRequest(BaseModel):
    email: EmailStr


class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime
    invite_url: str

    model_config = {"from_attributes": True}


class AcceptInvitationRequest(BaseModel):
    token: str
