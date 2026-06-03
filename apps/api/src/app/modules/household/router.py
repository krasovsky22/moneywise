from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.core.config import settings
from app.core.database import get_db
from app.modules.household.schemas import (
    AcceptInvitationRequest,
    HouseholdMemberResponse,
    HouseholdResponse,
    InvitationResponse,
    InviteRequest,
    UpdateHouseholdRequest,
)
from app.modules.household.service import (
    accept_invitation,
    create_invitation,
    get_household_for_user,
    get_members,
    get_pending_invitations,
    leave_household,
    revoke_invitation,
    update_household_name,
    update_household_sandbox,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/household", tags=["household"])


@router.get("", response_model=HouseholdResponse)
async def get_household(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdResponse:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    return HouseholdResponse.model_validate(household)


@router.patch("", response_model=HouseholdResponse)
async def patch_household(
    body: UpdateHouseholdRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdResponse:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    if body.name is not None:
        household = await update_household_name(db, household, body.name)
    if body.is_plaid_sandbox is not None:
        household = await update_household_sandbox(db, household, body.is_plaid_sandbox)
    return HouseholdResponse.model_validate(household)


@router.get("/members", response_model=list[HouseholdMemberResponse])
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HouseholdMemberResponse]:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    rows = await get_members(db, household.id)
    return [
        HouseholdMemberResponse(
            user_id=member.user_id,
            email=user.email,
            display_name=user.display_name,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, user in rows
    ]


@router.post(
    "/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InvitationResponse:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    invitation, raw_token = await create_invitation(
        db,
        household_id=household.id,
        invited_by_user_id=current_user.id,
        email=str(body.email),
        base_url=settings.FRONTEND_URL,
    )
    invite_url = f"{settings.FRONTEND_URL}/secure/join-household?token={raw_token}"
    return InvitationResponse(
        id=invitation.id,
        email=invitation.email,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        invite_url=invite_url,
    )


@router.get("/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InvitationResponse]:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    invitations = await get_pending_invitations(db, household.id)
    return [
        InvitationResponse(
            id=inv.id,
            email=inv.email,
            status=inv.status,
            expires_at=inv.expires_at,
            created_at=inv.created_at,
            invite_url=f"{settings.FRONTEND_URL}/secure/join-household?token=REDACTED",
        )
        for inv in invitations
    ]


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invitation(
    invitation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    household = await get_household_for_user(db, current_user.id)
    if household is None:
        raise NotFoundError("No household found for current user")
    await revoke_invitation(db, invitation_id, household.id)


@router.post("/accept-invitation", response_model=HouseholdResponse)
async def accept_invite(
    body: AcceptInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdResponse:
    household = await accept_invitation(db, body.token, current_user.id)
    return HouseholdResponse.model_validate(household)


@router.post("/leave", response_model=HouseholdResponse)
async def leave(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdResponse:
    new_household = await leave_household(db, current_user.id)
    return HouseholdResponse.model_validate(new_household)
