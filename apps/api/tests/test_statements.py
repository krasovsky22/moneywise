from __future__ import annotations

import io

from httpx import AsyncClient

_REGISTER_URL = "/api/v1/auth/register"
_CARDS_URL = "/api/v1/cards"
_STATEMENTS_URL = "/api/v1/statements"

_EMAIL = "statements_user@example.com"
_PASSWORD = "securepassword123"

_VALID_CSV_CONTENT = b"date,description,amount\n2024-01-01,Coffee,-5.00\n"

_VALID_CARD = {
    "nickname": "Test Card",
    "issuer": "Chase",
    "last4": "9999",
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


async def _create_card(client: AsyncClient, headers: dict[str, str]) -> str:
    resp = await client.post(_CARDS_URL, json=_VALID_CARD, headers=headers)
    assert resp.status_code == 201
    return str(resp.json()["id"])


def _csv_files(
    content: bytes = _VALID_CSV_CONTENT,
    filename: str = "statement.csv",
) -> dict[str, object]:
    return {"file": (filename, io.BytesIO(content), "text/csv")}


def _upload_data(account_id: str, account_type: str = "card") -> dict[str, str]:
    return {"account_type": account_type, "account_id": account_id}


# ---------------------------------------------------------------------------
# POST /statements — upload
# ---------------------------------------------------------------------------


async def test_upload_statement_requires_auth(db_client: AsyncClient) -> None:
    resp = await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data={
            "account_type": "card",
            "account_id": "00000000-0000-0000-0000-000000000001",
        },
    )
    assert resp.status_code == 401


async def test_upload_statement_invalid_mime(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)
    resp = await db_client.post(
        _STATEMENTS_URL,
        files={"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")},
        data=_upload_data(card_id),
        headers=headers,
    )
    assert resp.status_code == 422


async def test_upload_statement_csv_success(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)
    resp = await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["duplicate"] is False
    assert body["statement"] is not None
    assert body["statement"]["status"] == "queued"
    assert body["statement"]["file_mime"] == "text/csv"
    assert body["statement"]["file_original_name"] == "statement.csv"
    assert body["statement"]["card_id"] == card_id
    assert body["existing_statement_id"] is None


async def test_upload_statement_duplicate_detected(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)
    data = _upload_data(card_id)

    resp1 = await db_client.post(
        _STATEMENTS_URL, files=_csv_files(), data=data, headers=headers
    )
    assert resp1.status_code == 201
    assert resp1.json()["duplicate"] is False
    original_id = resp1.json()["statement"]["id"]

    resp2 = await db_client.post(
        _STATEMENTS_URL, files=_csv_files(), data=data, headers=headers
    )
    assert resp2.status_code == 201
    body2 = resp2.json()
    assert body2["duplicate"] is True
    assert body2["existing_statement_id"] == original_id
    assert body2["statement"] is None


# ---------------------------------------------------------------------------
# GET /statements — list
# ---------------------------------------------------------------------------


async def test_list_statements_empty(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.get(_STATEMENTS_URL, headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_statements_returns_uploaded(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )

    resp = await db_client.get(_STATEMENTS_URL, headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["status"] == "queued"


async def test_list_statements_filter_by_status(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )

    resp_queued = await db_client.get(
        _STATEMENTS_URL, params={"status": "queued"}, headers=headers
    )
    assert len(resp_queued.json()) == 1

    resp_ready = await db_client.get(
        _STATEMENTS_URL, params={"status": "ready"}, headers=headers
    )
    assert resp_ready.json() == []


async def test_list_statements_filter_by_card_id(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )

    resp = await db_client.get(
        _STATEMENTS_URL, params={"card_id": card_id}, headers=headers
    )
    assert len(resp.json()) == 1

    other_card_id = "00000000-0000-0000-0000-000000000099"
    resp2 = await db_client.get(
        _STATEMENTS_URL, params={"card_id": other_card_id}, headers=headers
    )
    assert resp2.json() == []


# ---------------------------------------------------------------------------
# GET /statements/{id} — detail
# ---------------------------------------------------------------------------


async def test_get_statement_success(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    upload = await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )
    statement_id = upload.json()["statement"]["id"]

    resp = await db_client.get(f"{_STATEMENTS_URL}/{statement_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == statement_id


async def test_get_statement_not_found(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.get(
        f"{_STATEMENTS_URL}/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /statements/{id}/status
# ---------------------------------------------------------------------------


async def test_get_statement_status(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    upload = await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )
    statement_id = upload.json()["statement"]["id"]

    resp = await db_client.get(
        f"{_STATEMENTS_URL}/{statement_id}/status", headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == statement_id
    assert body["status"] == "queued"
    assert body["failure_reason"] is None
    assert body["processed_at"] is None


# ---------------------------------------------------------------------------
# DELETE /statements/{id}
# ---------------------------------------------------------------------------


async def test_delete_statement_success(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    upload = await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )
    statement_id = upload.json()["statement"]["id"]

    resp = await db_client.delete(f"{_STATEMENTS_URL}/{statement_id}", headers=headers)
    assert resp.status_code == 204

    resp2 = await db_client.get(f"{_STATEMENTS_URL}/{statement_id}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_statement_not_found(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    resp = await db_client.delete(
        f"{_STATEMENTS_URL}/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /statements/{id}/reprocess
# ---------------------------------------------------------------------------


async def test_reprocess_non_failed_statement_rejected(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    card_id = await _create_card(db_client, headers)

    upload = await db_client.post(
        _STATEMENTS_URL,
        files=_csv_files(),
        data=_upload_data(card_id),
        headers=headers,
    )
    statement_id = upload.json()["statement"]["id"]

    resp = await db_client.post(
        f"{_STATEMENTS_URL}/{statement_id}/reprocess", headers=headers
    )
    assert resp.status_code == 422
