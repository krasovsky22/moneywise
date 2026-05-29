from __future__ import annotations

from httpx import AsyncClient

_REGISTER_URL = "/api/v1/auth/register"
_LOGIN_URL = "/api/v1/auth/login"
_CARDS_URL = "/api/v1/cards"

_EMAIL = "cards_user@example.com"
_PASSWORD = "securepassword123"

_VALID_CARD = {
    "nickname": "Chase Sapphire",
    "issuer": "Chase",
    "last4": "1234",
    "network": "visa",
    "statement_close_day": 15,
    "payment_due_day": 10,
}


async def _auth_header(client: AsyncClient) -> dict[str, str]:
    resp = await client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ---------------------------------------------------------------------------
# POST /cards — create
# ---------------------------------------------------------------------------


async def test_create_card_success(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["nickname"] == "Chase Sapphire"
    assert body["last4"] == "1234"
    assert body["network"] == "visa"
    assert body["is_archived"] is False
    assert body["archived_at"] is None
    assert "id" in body
    assert "household_id" in body


async def test_create_card_requires_auth(db_client: AsyncClient) -> None:
    resp = await db_client.post(_CARDS_URL, json=_VALID_CARD)
    assert resp.status_code == 401


async def test_create_card_invalid_statement_day(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    bad = {**_VALID_CARD, "statement_close_day": 0}
    resp = await db_client.post(_CARDS_URL, json=bad, headers=headers)
    assert resp.status_code == 422


async def test_create_card_invalid_due_day(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    bad = {**_VALID_CARD, "payment_due_day": 32}
    resp = await db_client.post(_CARDS_URL, json=bad, headers=headers)
    assert resp.status_code == 422


async def test_create_card_sets_only_one_default(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)

    card1 = await db_client.post(
        _CARDS_URL, json={**_VALID_CARD, "is_default": True}, headers=headers
    )
    assert card1.json()["is_default"] is True

    card2 = await db_client.post(
        _CARDS_URL,
        json={**_VALID_CARD, "nickname": "Amex Gold", "last4": "5678",
              "is_default": True},
        headers=headers,
    )
    assert card2.json()["is_default"] is True

    # Re-fetch first card — it should no longer be default
    card1_id = card1.json()["id"]
    fetched = await db_client.get(f"{_CARDS_URL}/{card1_id}", headers=headers)
    assert fetched.json()["is_default"] is False


# ---------------------------------------------------------------------------
# GET /cards — list
# ---------------------------------------------------------------------------


async def test_list_cards_empty(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.get(_CARDS_URL, headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_cards_excludes_archived_by_default(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)

    card_resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    card_id = card_resp.json()["id"]

    await db_client.post(f"{_CARDS_URL}/{card_id}/archive", headers=headers)

    resp = await db_client.get(_CARDS_URL, headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_cards_includes_archived_when_requested(
    db_client: AsyncClient,
) -> None:
    headers = await _auth_header(db_client)

    card_resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    card_id = card_resp.json()["id"]
    await db_client.post(f"{_CARDS_URL}/{card_id}/archive", headers=headers)

    resp = await db_client.get(
        _CARDS_URL, params={"include_archived": "true"}, headers=headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["is_archived"] is True


# ---------------------------------------------------------------------------
# GET /cards/{card_id}
# ---------------------------------------------------------------------------


async def test_get_card_success(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    create_resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    card_id = create_resp.json()["id"]

    resp = await db_client.get(f"{_CARDS_URL}/{card_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == card_id


async def test_get_card_not_found(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.get(
        f"{_CARDS_URL}/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /cards/{card_id}
# ---------------------------------------------------------------------------


async def test_update_card_success(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    create_resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    card_id = create_resp.json()["id"]

    resp = await db_client.patch(
        f"{_CARDS_URL}/{card_id}",
        json={"nickname": "Updated Name", "color": "#FF0000"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["nickname"] == "Updated Name"
    assert body["color"] == "#FF0000"
    assert body["issuer"] == "Chase"


async def test_update_card_not_found(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.patch(
        f"{_CARDS_URL}/00000000-0000-0000-0000-000000000000",
        json={"nickname": "X"},
        headers=headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /cards/{card_id}/archive & /unarchive
# ---------------------------------------------------------------------------


async def test_archive_card(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    create_resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    card_id = create_resp.json()["id"]

    resp = await db_client.post(f"{_CARDS_URL}/{card_id}/archive", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_archived"] is True
    assert body["archived_at"] is not None


async def test_unarchive_card(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    create_resp = await db_client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    card_id = create_resp.json()["id"]

    await db_client.post(f"{_CARDS_URL}/{card_id}/archive", headers=headers)

    resp = await db_client.post(f"{_CARDS_URL}/{card_id}/unarchive", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_archived"] is False
    assert body["archived_at"] is None


async def test_archive_not_found(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.post(
        f"{_CARDS_URL}/00000000-0000-0000-0000-000000000000/archive", headers=headers
    )
    assert resp.status_code == 404
