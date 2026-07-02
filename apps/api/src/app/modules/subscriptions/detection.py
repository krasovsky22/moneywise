"""Heuristic recurring-charge detection (Epic F05).

Scans a household's expense transactions and groups them into candidate
subscriptions: same merchant + similar amount + regular cadence over at
least two occurrences. Candidates surface as ``pending_review``
subscriptions for the user to confirm or dismiss.
"""

from __future__ import annotations

import calendar
import uuid
from dataclasses import dataclass
from datetime import UTC as _UTC
from datetime import date, datetime, timedelta
from decimal import Decimal
from statistics import median

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.subscriptions.models import (
    Subscription,
    SubscriptionCharge,
    SubscriptionFrequency,
    SubscriptionSource,
    SubscriptionStatus,
)
from app.modules.transactions.models import Transaction, TransactionType

logger = structlog.get_logger(__name__)

# Amounts within max(absolute, fraction * typical) of each other are treated
# as the same recurring charge (covers tax changes and small price wobble).
AMOUNT_TOLERANCE_ABS = Decimal("2.00")
AMOUNT_TOLERANCE_FRACTION = Decimal("0.15")

# (period_days, median-gap window, per-gap slack) per cadence.
_CADENCES: list[tuple[SubscriptionFrequency, int, range, int]] = [
    (SubscriptionFrequency.weekly, 7, range(5, 10), 3),
    (SubscriptionFrequency.monthly, 30, range(26, 36), 7),
    (SubscriptionFrequency.quarterly, 91, range(80, 104), 14),
    (SubscriptionFrequency.yearly, 365, range(350, 381), 25),
]


@dataclass
class DetectionResult:
    created: int = 0
    updated: int = 0
    charges_linked: int = 0


@dataclass
class _TxRow:
    id: uuid.UUID
    tx_date: date
    amount: Decimal
    merchant: str


def _normalize_merchant(merchant: str) -> str:
    return " ".join(merchant.lower().split())


def _amounts_match(a: Decimal, b: Decimal) -> bool:
    tolerance = max(AMOUNT_TOLERANCE_ABS, AMOUNT_TOLERANCE_FRACTION * max(a, b))
    return abs(a - b) <= tolerance


def _classify_cadence(gaps: list[int]) -> SubscriptionFrequency | None:
    """Match the gap pattern to a cadence, or None if irregular."""
    med = int(median(gaps))
    for frequency, _period, window, slack in _CADENCES:
        # Median lands in the cadence window and every individual gap stays
        # within the cadence's slack of the median (a skipped month or an
        # ad-hoc extra purchase breaks the pattern).
        if med in window and all(abs(gap - med) <= slack for gap in gaps):
            return frequency
    return None


def _add_months(day: date, months: int) -> date:
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def next_charge_date(last_charge: date, frequency: SubscriptionFrequency) -> date:
    if frequency == SubscriptionFrequency.weekly:
        return last_charge + timedelta(days=7)
    if frequency == SubscriptionFrequency.monthly:
        return _add_months(last_charge, 1)
    if frequency == SubscriptionFrequency.quarterly:
        return _add_months(last_charge, 3)
    return _add_months(last_charge, 12)


def _cluster_by_amount(txs: list[_TxRow]) -> list[list[_TxRow]]:
    """Split one merchant's transactions into similar-amount clusters.

    Allows two subscriptions to the same merchant at different price
    points (e.g. two Apple services) to stay separate.
    """
    clusters: list[list[_TxRow]] = []
    for tx in sorted(txs, key=lambda t: t.amount):
        for cluster in clusters:
            typical = median(t.amount for t in cluster)
            if _amounts_match(tx.amount, Decimal(typical)):
                cluster.append(tx)
                break
        else:
            clusters.append([tx])
    return clusters


def _dedupe_by_date(txs: list[_TxRow]) -> list[_TxRow]:
    seen: set[date] = set()
    result: list[_TxRow] = []
    for tx in sorted(txs, key=lambda t: t.tx_date):
        if tx.tx_date not in seen:
            seen.add(tx.tx_date)
            result.append(tx)
    return result


async def detect_subscriptions(
    db: AsyncSession, household_id: uuid.UUID
) -> DetectionResult:
    """Scan household transactions and create/refresh subscription proposals."""
    result = DetectionResult()

    rows = (
        await db.execute(
            select(
                Transaction.id,
                Transaction.date,
                Transaction.amount,
                Transaction.merchant_clean,
            ).where(
                Transaction.household_id == household_id,
                Transaction.transaction_type == TransactionType.expense,
                Transaction.is_deleted.is_(False),
                Transaction.pending.is_(False),
                Transaction.amount > 0,
                Transaction.merchant_clean != "",
            )
        )
    ).all()

    by_merchant: dict[str, list[_TxRow]] = {}
    for tx_id, tx_date, amount, merchant in rows:
        key = _normalize_merchant(merchant)
        by_merchant.setdefault(key, []).append(
            _TxRow(id=tx_id, tx_date=tx_date, amount=amount, merchant=merchant)
        )

    existing_subs = list(
        (
            await db.execute(
                select(Subscription).where(Subscription.household_id == household_id)
            )
        )
        .scalars()
        .all()
    )

    linked_tx_ids: set[uuid.UUID] = set(
        (
            await db.execute(
                select(SubscriptionCharge.transaction_id)
                .join(
                    Subscription,
                    Subscription.id == SubscriptionCharge.subscription_id,
                )
                .where(Subscription.household_id == household_id)
            )
        )
        .scalars()
        .all()
    )

    for merchant_key, merchant_txs in by_merchant.items():
        for cluster in _cluster_by_amount(merchant_txs):
            charges = _dedupe_by_date(cluster)
            if len(charges) < 2:
                continue

            gaps = [
                (charges[i + 1].tx_date - charges[i].tx_date).days
                for i in range(len(charges) - 1)
            ]
            frequency = _classify_cadence(gaps)
            if frequency is None:
                continue

            amount_typical = Decimal(median(c.amount for c in charges)).quantize(
                Decimal("0.01")
            )

            subscription = _find_matching_subscription(
                existing_subs, merchant_key, amount_typical
            )
            if subscription is not None and subscription.status in (
                SubscriptionStatus.dismissed,
                SubscriptionStatus.cancelled,
            ):
                continue

            last = charges[-1].tx_date
            if subscription is None:
                subscription = Subscription(
                    household_id=household_id,
                    merchant_clean=charges[-1].merchant,
                    amount_typical=amount_typical,
                    frequency=frequency,
                    anchor_day=last.day,
                    status=SubscriptionStatus.pending_review,
                    source=SubscriptionSource.detected,
                    first_seen_at=charges[0].tx_date,
                    last_seen_at=last,
                    next_expected_charge_date=next_charge_date(last, frequency),
                )
                db.add(subscription)
                await db.flush()
                existing_subs.append(subscription)
                result.created += 1
            else:
                changed = False
                if (
                    subscription.last_seen_at is None
                    or last > subscription.last_seen_at
                ):
                    subscription.last_seen_at = last
                    subscription.amount_typical = amount_typical
                    subscription.next_expected_charge_date = next_charge_date(
                        last, subscription.frequency
                    )
                    subscription.updated_at = datetime.now(_UTC)
                    changed = True
                if (
                    subscription.first_seen_at is None
                    or charges[0].tx_date < subscription.first_seen_at
                ):
                    subscription.first_seen_at = charges[0].tx_date
                    changed = True
                if changed:
                    result.updated += 1

            for charge in charges:
                if charge.id in linked_tx_ids:
                    continue
                db.add(
                    SubscriptionCharge(
                        subscription_id=subscription.id,
                        transaction_id=charge.id,
                        occurred_on=charge.tx_date,
                        amount=charge.amount,
                        deviation_from_typical=charge.amount - amount_typical,
                    )
                )
                linked_tx_ids.add(charge.id)
                result.charges_linked += 1

    await db.flush()
    logger.info(
        "subscription_detection_completed",
        household_id=str(household_id),
        created=result.created,
        updated=result.updated,
        charges_linked=result.charges_linked,
    )
    return result


def _find_matching_subscription(
    subscriptions: list[Subscription],
    merchant_key: str,
    amount_typical: Decimal,
) -> Subscription | None:
    for sub in subscriptions:
        if _normalize_merchant(sub.merchant_clean) == merchant_key and _amounts_match(
            sub.amount_typical, amount_typical
        ):
            return sub
    return None
