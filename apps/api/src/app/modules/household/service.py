from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundError
from app.modules.household.models import (
    Household,
    HouseholdMember,
    Invitation,
    InvitationStatus,
)
from app.modules.users.models import User


async def create_household(db: AsyncSession, name: str) -> Household:
    household = Household(name=name)
    db.add(household)
    await db.flush()
    return household


async def add_member(
    db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID
) -> HouseholdMember:
    member = HouseholdMember(household_id=household_id, user_id=user_id)
    db.add(member)
    await db.flush()
    return member


async def get_household_for_user(
    db: AsyncSession, user_id: uuid.UUID
) -> Household | None:
    result = await db.execute(
        select(Household)
        .join(HouseholdMember, HouseholdMember.household_id == Household.id)
        .where(HouseholdMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_members(
    db: AsyncSession, household_id: uuid.UUID
) -> list[tuple[HouseholdMember, User]]:
    result = await db.execute(
        select(HouseholdMember, User)
        .join(User, User.id == HouseholdMember.user_id)
        .where(HouseholdMember.household_id == household_id)
    )
    return list(result.tuples().all())


async def update_household_name(
    db: AsyncSession, household: Household, name: str
) -> Household:
    household.name = name
    await db.flush()
    return household


async def create_invitation(
    db: AsyncSession,
    household_id: uuid.UUID,
    invited_by_user_id: uuid.UUID,
    email: str,
    base_url: str,
) -> tuple[Invitation, str]:
    # Revoke any existing pending invitation for the same household+email
    existing_result = await db.execute(
        select(Invitation).where(
            Invitation.household_id == household_id,
            Invitation.email == email,
            Invitation.status == InvitationStatus.pending,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        existing.status = InvitationStatus.revoked
        await db.flush()

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=7)

    invitation = Invitation(
        household_id=household_id,
        invited_by_user_id=invited_by_user_id,
        email=email,
        token_hash=token_hash,
        expires_at=expires_at,
        status=InvitationStatus.pending,
    )
    db.add(invitation)
    await db.flush()
    return invitation, raw_token


async def get_pending_invitations(
    db: AsyncSession, household_id: uuid.UUID
) -> list[Invitation]:
    result = await db.execute(
        select(Invitation).where(
            Invitation.household_id == household_id,
            Invitation.status == InvitationStatus.pending,
        )
    )
    return list(result.scalars().all())


async def revoke_invitation(
    db: AsyncSession, invitation_id: uuid.UUID, household_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.household_id == household_id,
        )
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise NotFoundError("Invitation not found")
    invitation.status = InvitationStatus.revoked
    await db.flush()


async def accept_invitation(
    db: AsyncSession, token: str, user_id: uuid.UUID
) -> Household:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(UTC)

    result = await db.execute(
        select(Invitation).where(
            Invitation.token_hash == token_hash,
            Invitation.status == InvitationStatus.pending,
        )
    )
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise NotFoundError("Invitation not found")

    if invitation.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invitation has expired",
        )

    # Remove user from their current household
    current_member_result = await db.execute(
        select(HouseholdMember).where(HouseholdMember.user_id == user_id)
    )
    current_member = current_member_result.scalar_one_or_none()
    if current_member is not None:
        old_household_id = current_member.household_id
        await db.delete(current_member)
        await db.flush()

        # Count remaining members; delete household if empty
        count_result = await db.execute(
            select(func.count()).where(HouseholdMember.household_id == old_household_id)
        )
        remaining: int = count_result.scalar_one()
        if remaining == 0:
            old_household_result = await db.execute(
                select(Household).where(Household.id == old_household_id)
            )
            old_household = old_household_result.scalar_one_or_none()
            if old_household is not None:
                await db.delete(old_household)
                await db.flush()

    await add_member(db, invitation.household_id, user_id)
    invitation.status = InvitationStatus.accepted
    await db.flush()

    household_result = await db.execute(
        select(Household).where(Household.id == invitation.household_id)
    )
    household = household_result.scalar_one()
    return household


async def leave_household(db: AsyncSession, user_id: uuid.UUID) -> Household:
    member_result = await db.execute(
        select(HouseholdMember).where(HouseholdMember.user_id == user_id)
    )
    member = member_result.scalar_one_or_none()

    if member is not None:
        old_household_id = member.household_id
        await db.delete(member)
        await db.flush()

        count_result = await db.execute(
            select(func.count()).where(HouseholdMember.household_id == old_household_id)
        )
        remaining: int = count_result.scalar_one()
        if remaining == 0:
            await db.execute(delete(Household).where(Household.id == old_household_id))
            await db.flush()

    # Fetch user email to name the new household
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()
    email_prefix = user.email.split("@")[0].replace(".", " ").title()
    new_household = await create_household(db, f"{email_prefix}'s Household")
    await add_member(db, new_household.id, user_id)
    return new_household
