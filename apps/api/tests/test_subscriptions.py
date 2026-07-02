from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from httpx import AsyncClient

from app.modules.subscriptions.detection import (
    _classify_cadence,
    _cluster_by_amount,
    _TxRow,
    next_charge_date,
)
from app.modules.subscriptions.models import SubscriptionFrequency

_REGISTER_URL = "/api/v1/auth/register"
_TX_URL = "/api/v1/transactions"
_SUBS_URL = "/api/v1/subscriptions"
_DETECT_URL = "/api/v1/subscriptions/detect"

_EMAIL = "subs_user@example.com"
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
        "amount": "15.99",
        "merchant_clean": "Netflix",
        "transaction_type": "expense",
    }
    payload.update(overrides)
    resp = await client.post(_TX_URL, json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return dict(resp.json())


async def _detect(client: AsyncClient, headers: dict[str, str]) -> dict[str, Any]:
    resp = await client.post(_DETECT_URL, headers=headers)
    assert resp.status_code == 200, resp.text
    return dict(resp.json())


# ---------------------------------------------------------------------------
# Pure heuristics
# ---------------------------------------------------------------------------


def test_classify_cadence_windows() -> None:
    assert _classify_cadence([7, 7, 8]) == SubscriptionFrequency.weekly
    assert _classify_cadence([30, 31, 29]) == SubscriptionFrequency.monthly
    assert _classify_cadence([90, 92]) == SubscriptionFrequency.quarterly
    assert _classify_cadence([365]) == SubscriptionFrequency.yearly
    # Irregular gaps must not classify.
    assert _classify_cadence([30, 3, 55]) is None
    assert _classify_cadence([14]) is None


def test_next_charge_date_handles_month_ends() -> None:
    assert next_charge_date(date(2026, 1, 31), SubscriptionFrequency.monthly) == date(
        2026, 2, 28
    )
    assert next_charge_date(date(2026, 6, 15), SubscriptionFrequency.weekly) == date(
        2026, 6, 22
    )
    assert next_charge_date(
        date(2026, 11, 30), SubscriptionFrequency.quarterly
    ) == date(2027, 2, 28)
    assert next_charge_date(date(2026, 2, 28), SubscriptionFrequency.yearly) == date(
        2027, 2, 28
    )


def test_cluster_by_amount_separates_price_points() -> None:
    def row(amount: str, day: int) -> _TxRow:
        return _TxRow(
            id=None,  # type: ignore[arg-type]
            tx_date=date(2026, 6, day),
            amount=Decimal(amount),
            merchant="Apple",
        )

    clusters = _cluster_by_amount(
        [row("9.99", 1), row("9.99", 2), row("99.99", 3), row("100.99", 4)]
    )
    amounts = sorted(sorted(t.amount for t in c) for c in clusters)
    assert amounts == [
        [Decimal("9.99"), Decimal("9.99")],
        [Decimal("99.99"), Decimal("100.99")],
    ]


# ---------------------------------------------------------------------------
# Detection end-to-end (API)
# ---------------------------------------------------------------------------


async def test_detects_monthly_subscription(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    for d in ("2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15"):
        await _create_tx(db_client, headers, date=d)

    result = await _detect(db_client, headers)
    assert result["created"] == 1
    assert result["charges_linked"] == 4

    resp = await db_client.get(_SUBS_URL, headers=headers)
    subs = resp.json()
    assert len(subs) == 1
    sub = subs[0]
    assert sub["merchant_clean"] == "Netflix"
    assert sub["frequency"] == "monthly"
    assert sub["status"] == "pending_review"
    assert sub["amount_typical"] == "15.99"
    assert sub["next_expected_charge_date"] == "2026-07-15"
    assert sub["first_seen_at"] == "2026-03-15"
    assert sub["last_seen_at"] == "2026-06-15"

    charges_resp = await db_client.get(
        f"{_SUBS_URL}/{sub['id']}/charges", headers=headers
    )
    assert charges_resp.status_code == 200
    assert len(charges_resp.json()) == 4


async def test_ignores_irregular_and_one_off_charges(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    # One-off purchase.
    await _create_tx(db_client, headers, merchant_clean="Hardware Store")
    # Irregular cadence at the same merchant/amount.
    for d in ("2026-01-03", "2026-01-20", "2026-03-11", "2026-06-02"):
        await _create_tx(
            db_client, headers, merchant_clean="Grocer", amount="50.00", date=d
        )

    result = await _detect(db_client, headers)
    assert result["created"] == 0

    resp = await db_client.get(_SUBS_URL, headers=headers)
    assert resp.json() == []


async def test_detection_is_idempotent_and_updates(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    for d in ("2026-04-10", "2026-05-10"):
        await _create_tx(db_client, headers, date=d)

    first = await _detect(db_client, headers)
    assert first["created"] == 1

    # Re-running with no new data creates nothing and links nothing new.
    second = await _detect(db_client, headers)
    assert second["created"] == 0
    assert second["charges_linked"] == 0

    # A new charge extends the same subscription instead of duplicating it.
    await _create_tx(db_client, headers, date="2026-06-10")
    third = await _detect(db_client, headers)
    assert third["created"] == 0
    assert third["updated"] == 1
    assert third["charges_linked"] == 1

    resp = await db_client.get(_SUBS_URL, headers=headers)
    subs = resp.json()
    assert len(subs) == 1
    assert subs[0]["last_seen_at"] == "2026-06-10"
    assert subs[0]["next_expected_charge_date"] == "2026-07-10"


async def test_dismissed_subscription_stays_dismissed(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    for d in ("2026-04-01", "2026-05-01"):
        await _create_tx(db_client, headers, date=d)
    await _detect(db_client, headers)

    resp = await db_client.get(_SUBS_URL, headers=headers)
    sub_id = resp.json()[0]["id"]

    dismiss = await db_client.post(f"{_SUBS_URL}/{sub_id}/dismiss", headers=headers)
    assert dismiss.status_code == 200
    assert dismiss.json()["status"] == "dismissed"

    # New matching charge must not resurrect or duplicate the proposal.
    await _create_tx(db_client, headers, date="2026-06-01")
    result = await _detect(db_client, headers)
    assert result["created"] == 0
    assert result["updated"] == 0

    resp = await db_client.get(_SUBS_URL, headers=headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "dismissed"


async def test_confirm_flow(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)
    for d in ("2026-05-05", "2026-06-05"):
        await _create_tx(db_client, headers, date=d)
    await _detect(db_client, headers)

    resp = await db_client.get(
        _SUBS_URL, params={"status_filter": "pending_review"}, headers=headers
    )
    sub_id = resp.json()[0]["id"]

    confirm = await db_client.post(f"{_SUBS_URL}/{sub_id}/confirm", headers=headers)
    assert confirm.status_code == 200
    assert confirm.json()["status"] == "active"

    # Confirming twice conflicts.
    again = await db_client.post(f"{_SUBS_URL}/{sub_id}/confirm", headers=headers)
    assert again.status_code == 409


async def test_manual_subscription_crud(db_client: AsyncClient) -> None:
    headers = await _auth_header(db_client)

    create = await db_client.post(
        _SUBS_URL,
        json={
            "merchant_clean": "Spotify",
            "amount_typical": "11.99",
            "frequency": "monthly",
            "next_expected_charge_date": "2026-07-20",
            "notes": "Family plan — cancel at spotify.com/account",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    sub = create.json()
    assert sub["source"] == "manual"
    assert sub["status"] == "active"
    assert sub["anchor_day"] == 20

    patch = await db_client.patch(
        f"{_SUBS_URL}/{sub['id']}",
        json={"status": "cancelled", "notes": "Cancelled June 2026"},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["status"] == "cancelled"

    delete = await db_client.delete(f"{_SUBS_URL}/{sub['id']}", headers=headers)
    assert delete.status_code == 204

    resp = await db_client.get(_SUBS_URL, headers=headers)
    assert resp.json() == []


async def test_subscriptions_require_auth(db_client: AsyncClient) -> None:
    resp = await db_client.get(_SUBS_URL)
    assert resp.status_code == 401
    resp = await db_client.post(_DETECT_URL)
    assert resp.status_code == 401
