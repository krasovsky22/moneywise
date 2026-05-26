from __future__ import annotations

from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REGISTER_URL = "/api/v1/auth/register"
_LOGIN_URL = "/api/v1/auth/login"
_LOGOUT_URL = "/api/v1/auth/logout"
_REFRESH_URL = "/api/v1/auth/refresh"
_CHANGE_PW_URL = "/api/v1/auth/change-password"
_ME_URL = "/api/v1/users/me"

_EMAIL = "test@example.com"
_PASSWORD = "securepassword123"


async def _register_and_login(client: AsyncClient) -> tuple[str, str]:
    """Register a user and return (access_token, refresh_token cookie value)."""
    resp = await client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    access_token: str = resp.json()["access_token"]
    refresh_token = resp.cookies.get("refresh_token", "")
    return access_token, refresh_token


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


async def test_register_success(db_client: AsyncClient) -> None:
    resp = await db_client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert "access_token" in body
    assert "refresh_token" in resp.cookies


async def test_register_duplicate_email(db_client: AsyncClient) -> None:
    await db_client.post(_REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD})
    resp = await db_client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


async def test_register_password_too_short(db_client: AsyncClient) -> None:
    resp = await db_client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": "short"}
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


async def test_login_success(db_client: AsyncClient) -> None:
    await db_client.post(_REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD})
    resp = await db_client.post(
        _LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in resp.cookies


async def test_login_wrong_password(db_client: AsyncClient) -> None:
    await db_client.post(_REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD})
    resp = await db_client.post(
        _LOGIN_URL, json={"email": _EMAIL, "password": "wrongpassword"}
    )
    assert resp.status_code == 401


async def test_login_unknown_email(db_client: AsyncClient) -> None:
    resp = await db_client.post(
        _LOGIN_URL, json={"email": "nobody@example.com", "password": _PASSWORD}
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


async def test_refresh_success(db_client: AsyncClient) -> None:
    _, refresh_token = await _register_and_login(db_client)
    db_client.cookies.set("refresh_token", refresh_token)
    resp = await db_client.post(_REFRESH_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    # New refresh cookie issued
    assert "refresh_token" in resp.cookies


async def test_refresh_missing_cookie(db_client: AsyncClient) -> None:
    db_client.cookies.clear()
    resp = await db_client.post(_REFRESH_URL)
    assert resp.status_code == 401


async def test_refresh_invalid_token(db_client: AsyncClient) -> None:
    db_client.cookies.set("refresh_token", "notavalidtoken")
    resp = await db_client.post(_REFRESH_URL)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


async def test_logout_success(db_client: AsyncClient) -> None:
    access_token, refresh_token = await _register_and_login(db_client)
    db_client.cookies.set("refresh_token", refresh_token)
    resp = await db_client.post(
        _LOGOUT_URL, headers={"Authorization": f"Bearer {access_token}"}
    )
    assert resp.status_code == 204


async def test_logout_requires_auth(db_client: AsyncClient) -> None:
    resp = await db_client.post(_LOGOUT_URL)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /users/me
# ---------------------------------------------------------------------------


async def test_get_me_success(db_client: AsyncClient) -> None:
    access_token, _ = await _register_and_login(db_client)
    resp = await db_client.get(
        _ME_URL, headers={"Authorization": f"Bearer {access_token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == _EMAIL
    assert "id" in body
    assert "created_at" in body
    assert "is_active" not in body


async def test_get_me_no_token(db_client: AsyncClient) -> None:
    resp = await db_client.get(_ME_URL)
    assert resp.status_code == 401


async def test_get_me_invalid_token(db_client: AsyncClient) -> None:
    resp = await db_client.get(
        _ME_URL, headers={"Authorization": "Bearer notavalidtoken"}
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------


async def test_change_password_success(db_client: AsyncClient) -> None:
    access_token, _ = await _register_and_login(db_client)
    resp = await db_client.post(
        _CHANGE_PW_URL,
        json={"current_password": _PASSWORD, "new_password": "newpassword456"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 204

    # Old access token still valid (JWT-based, not invalidated)
    # Verify new password works for login
    login_resp = await db_client.post(
        _LOGIN_URL, json={"email": _EMAIL, "password": "newpassword456"}
    )
    assert login_resp.status_code == 200


async def test_change_password_wrong_current(db_client: AsyncClient) -> None:
    access_token, _ = await _register_and_login(db_client)
    resp = await db_client.post(
        _CHANGE_PW_URL,
        json={"current_password": "wrongpassword", "new_password": "newpassword456"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 400


async def test_change_password_requires_auth(db_client: AsyncClient) -> None:
    resp = await db_client.post(
        _CHANGE_PW_URL,
        json={"current_password": _PASSWORD, "new_password": "newpassword456"},
    )
    assert resp.status_code == 401


async def test_change_password_new_too_short(db_client: AsyncClient) -> None:
    access_token, _ = await _register_and_login(db_client)
    resp = await db_client.post(
        _CHANGE_PW_URL,
        json={"current_password": _PASSWORD, "new_password": "short"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 422
