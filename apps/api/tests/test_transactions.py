from __future__ import annotations

from typing import Any

from httpx import AsyncClient

_REGISTER_URL = "/api/v1/auth/register"
_TX_URL = "/api/v1/transactions"
_SUMMARY_URL = "/api/v1/transactions/summary"
_EXPORT_URL = "/api/v1/transactions/export"

_EMAIL = "tx_user@example.com"
_PASSWORD = "securepassword123"


async def _auth_header(client: AsyncClient) -> dict[str, str]:
    resp = await client.post(
        _REGISTER_URL, json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_tx(
    client: AsyncClient, headers: dict[str, str], **overrides: Any
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "date": "2026-06-15",
        "amount": "100.00",
        "merchant_clean": "Test Store",
        "transaction_type": "expense",
    }
    payload.update(overrides)
    resp = await client.post(_TX_URL, json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return dict(resp.json())


def _month(summary: dict[str, Any], key: str) -> dict[str, Any]:
    by_month = {m["month"]: m for m in summary["months"]}
    assert key in by_month, f"month {key} missing from summary"
    return dict(by_month[key])


# ---------------------------------------------------------------------------
# CRUD basics
# ---------------------------------------------------------------------------


async def test_create_and_list_transactions(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    created = await _create_tx(db_client, headers)
    assert created["source"] == "manual"
    assert created["is_user_confirmed"] is True

    resp = await db_client.get(_TX_URL, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["merchant_clean"] == "Test Store"


async def test_list_filters_by_type_and_date(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    await _create_tx(db_client, headers, transaction_type="expense")
    await _create_tx(
        db_client,
        headers,
        transaction_type="income",
        merchant_clean="Employer",
        date="2026-05-01",
    )

    resp = await db_client.get(
        _TX_URL, params={"transaction_type": "income"}, headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["transaction_type"] == "income"

    resp = await db_client.get(
        _TX_URL,
        params={"date_from": "2026-06-01", "date_to": "2026-06-30"},
        headers=headers,
    )
    assert resp.json()["total"] == 1


async def test_transactions_require_auth(db_client: AsyncClient) -> None:
    resp = await db_client.get(_TX_URL)
    assert resp.status_code == 401
    resp = await db_client.get(
        _SUMMARY_URL, params={"date_from": "2026-06-01", "date_to": "2026-06-30"}
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /transactions/summary
# ---------------------------------------------------------------------------


async def test_summary_aggregates_by_month_and_type(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    await _create_tx(db_client, headers, date="2026-05-10", amount="100.50")
    await _create_tx(db_client, headers, date="2026-05-20", amount="49.50")
    await _create_tx(
        db_client,
        headers,
        date="2026-05-01",
        amount="500.00",
        transaction_type="income",
        merchant_clean="Employer",
    )
    await _create_tx(db_client, headers, date="2026-06-05", amount="40.00")
    await _create_tx(
        db_client,
        headers,
        date="2026-06-06",
        amount="10.00",
        transaction_type="refund",
    )

    resp = await db_client.get(
        _SUMMARY_URL,
        params={"date_from": "2026-05-01", "date_to": "2026-06-30"},
        headers=headers,
    )
    assert resp.status_code == 200
    summary = resp.json()
    assert len(summary["months"]) == 2

    may = _month(summary, "2026-05")
    assert float(may["expense"]) == 150.00
    assert float(may["income"]) == 500.00
    assert float(may["net"]) == 350.00
    assert may["transaction_count"] == 3

    june = _month(summary, "2026-06")
    assert float(june["expense"]) == 40.00
    assert float(june["refund"]) == 10.00
    assert float(june["net"]) == -30.00
    assert june["transaction_count"] == 2


async def test_summary_zero_fills_empty_months(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    await _create_tx(db_client, headers, date="2026-04-15")

    resp = await db_client.get(
        _SUMMARY_URL,
        params={"date_from": "2026-04-01", "date_to": "2026-06-30"},
        headers=headers,
    )
    summary = resp.json()
    assert [m["month"] for m in summary["months"]] == [
        "2026-04",
        "2026-05",
        "2026-06",
    ]
    may = _month(summary, "2026-05")
    assert float(may["expense"]) == 0.0
    assert may["transaction_count"] == 0


async def test_summary_excludes_deleted(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    kept = await _create_tx(db_client, headers, date="2026-06-01", amount="25.00")
    doomed = await _create_tx(db_client, headers, date="2026-06-02", amount="75.00")
    del kept

    resp = await db_client.delete(f"{_TX_URL}/{doomed['id']}", headers=headers)
    assert resp.status_code == 200

    resp = await db_client.get(
        _SUMMARY_URL,
        params={"date_from": "2026-06-01", "date_to": "2026-06-30"},
        headers=headers,
    )
    june = _month(resp.json(), "2026-06")
    assert float(june["expense"]) == 25.00
    assert june["transaction_count"] == 1


async def test_summary_excludes_split_parents(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    parent = await _create_tx(db_client, headers, date="2026-06-10", amount="100.00")

    resp = await db_client.post(
        f"{_TX_URL}/{parent['id']}/split",
        json={"parts": [{"amount": "60.00"}, {"amount": "40.00"}]},
        headers=headers,
    )
    assert resp.status_code == 200

    resp = await db_client.get(
        _SUMMARY_URL,
        params={"date_from": "2026-06-01", "date_to": "2026-06-30"},
        headers=headers,
    )
    june = _month(resp.json(), "2026-06")
    # Children (60 + 40) count; the split parent must not double the total.
    assert float(june["expense"]) == 100.00
    assert june["transaction_count"] == 2


async def test_summary_validates_dates(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)

    resp = await db_client.get(
        _SUMMARY_URL,
        params={"date_from": "junk", "date_to": "2026-06-30"},
        headers=headers,
    )
    assert resp.status_code == 422

    resp = await db_client.get(
        _SUMMARY_URL,
        params={"date_from": "2026-07-01", "date_to": "2026-06-01"},
        headers=headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /transactions/export
# ---------------------------------------------------------------------------


async def test_export_streams_csv(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    await _create_tx(db_client, headers, merchant_clean="Coffee Shop")
    await _create_tx(db_client, headers, merchant_clean="Grocery Mart")

    resp = await db_client.get(_EXPORT_URL, headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().splitlines()
    assert lines[0].startswith("date,card,merchant")
    assert len(lines) == 3
    assert any("Coffee Shop" in line for line in lines)
