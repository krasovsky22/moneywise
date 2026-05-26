from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import UnauthorizedError
from app.core.database import get_db
from app.core.security import create_access_token, generate_refresh_token
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.service import (
    authenticate_user,
    change_password,
    create_refresh_token_record,
    register_user,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.modules.users.dependencies import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

_COOKIE_MAX_AGE = 7 * 24 * 3600


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=False,
        samesite="strict",
        max_age=_COOKIE_MAX_AGE,
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await register_user(db, body.email, body.password)
    raw_token = generate_refresh_token()
    await create_refresh_token_record(db, user.id, raw_token)
    access_token = create_access_token(subject=str(user.id))
    _set_refresh_cookie(response, raw_token)
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await authenticate_user(db, body.email, body.password)
    raw_token = generate_refresh_token()
    await create_refresh_token_record(db, user.id, raw_token)
    access_token = create_access_token(subject=str(user.id))
    _set_refresh_cookie(response, raw_token)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if refresh_token is not None:
        await revoke_refresh_token(db, refresh_token)
    response.delete_cookie("refresh_token")


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if refresh_token is None:
        raise UnauthorizedError("Refresh token missing")
    user, new_raw = await rotate_refresh_token(db, refresh_token)
    access_token = create_access_token(subject=str(user.id))
    _set_refresh_cookie(response, new_raw)
    return TokenResponse(access_token=access_token)


@router.post("/change-password", status_code=204)
async def change_password_endpoint(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await change_password(db, current_user, body.current_password, body.new_password)
