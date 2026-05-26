from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ConflictError, UnauthorizedError
from app.core.config import settings
from app.core.security import (
    generate_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.users.models import User
from app.modules.users.service import create_user, get_user_by_email


async def register_user(db: AsyncSession, email: str, password: str) -> User:
    existing = await get_user_by_email(db, email)
    if existing is not None:
        raise ConflictError("An account with this email already exists")
    hashed = get_password_hash(password)
    return await create_user(db, email, hashed)


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    return user


async def create_refresh_token_record(
    db: AsyncSession, user_id: uuid.UUID, raw_token: str
) -> RefreshToken:
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    record = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=expires_at,
        revoked=False,
    )
    db.add(record)
    await db.flush()
    return record


async def rotate_refresh_token(db: AsyncSession, raw_token: str) -> tuple[User, str]:
    token_hash = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()

    now = datetime.now(UTC)
    if record is None or record.revoked or record.expires_at.replace(tzinfo=UTC) < now:
        raise UnauthorizedError("Invalid or expired refresh token")

    record.revoked = True
    await db.flush()

    result_user = await db.execute(select(User).where(User.id == record.user_id))
    user = result_user.scalar_one_or_none()
    if user is None:
        raise UnauthorizedError("User not found")

    new_raw = generate_refresh_token()
    await create_refresh_token_record(db, user.id, new_raw)
    return user, new_raw


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hash = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()
    if record is not None:
        record.revoked = True
        await db.flush()


async def change_password(
    db: AsyncSession,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    user.hashed_password = get_password_hash(new_password)
    await db.flush()
