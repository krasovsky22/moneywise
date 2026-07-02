from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ConflictError
from app.modules.subscriptions.models import (
    Subscription,
    SubscriptionCharge,
    SubscriptionSource,
    SubscriptionStatus,
)
from app.modules.subscriptions.schemas import SubscriptionCreate, SubscriptionUpdate


async def list_subscriptions(
    session: AsyncSession,
    household_id: uuid.UUID,
    status: SubscriptionStatus | None = None,
) -> list[Subscription]:
    stmt = select(Subscription).where(Subscription.household_id == household_id)
    if status is not None:
        stmt = stmt.where(Subscription.status == status)
    stmt = stmt.order_by(Subscription.next_expected_charge_date.asc().nulls_last())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_subscription(
    session: AsyncSession,
    subscription_id: uuid.UUID,
    household_id: uuid.UUID,
) -> Subscription | None:
    result = await session.execute(
        select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.household_id == household_id,
        )
    )
    return result.scalar_one_or_none()


async def create_manual_subscription(
    session: AsyncSession,
    household_id: uuid.UUID,
    data: SubscriptionCreate,
) -> Subscription:
    subscription = Subscription(
        household_id=household_id,
        merchant_clean=data.merchant_clean,
        amount_typical=data.amount_typical,
        currency=data.currency,
        frequency=data.frequency,
        anchor_day=(
            data.next_expected_charge_date.day
            if data.next_expected_charge_date
            else None
        ),
        status=SubscriptionStatus.active,
        next_expected_charge_date=data.next_expected_charge_date,
        notes=data.notes,
        source=SubscriptionSource.manual,
    )
    session.add(subscription)
    await session.flush()
    return subscription


async def update_subscription(
    session: AsyncSession,
    subscription: Subscription,
    data: SubscriptionUpdate,
) -> Subscription:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subscription, field, value)
    if (
        "next_expected_charge_date" in update_data
        and subscription.next_expected_charge_date
    ):
        subscription.anchor_day = subscription.next_expected_charge_date.day
    subscription.updated_at = datetime.now(UTC)
    await session.flush()
    return subscription


async def confirm_subscription(
    session: AsyncSession,
    subscription: Subscription,
) -> Subscription:
    if subscription.status != SubscriptionStatus.pending_review:
        raise ConflictError("Only pending subscriptions can be confirmed")
    subscription.status = SubscriptionStatus.active
    subscription.updated_at = datetime.now(UTC)
    await session.flush()
    return subscription


async def dismiss_subscription(
    session: AsyncSession,
    subscription: Subscription,
) -> Subscription:
    if subscription.status != SubscriptionStatus.pending_review:
        raise ConflictError("Only pending subscriptions can be dismissed")
    subscription.status = SubscriptionStatus.dismissed
    subscription.updated_at = datetime.now(UTC)
    await session.flush()
    return subscription


async def delete_subscription(
    session: AsyncSession,
    subscription: Subscription,
) -> None:
    await session.delete(subscription)
    await session.flush()


async def list_charges(
    session: AsyncSession,
    subscription_id: uuid.UUID,
) -> list[SubscriptionCharge]:
    result = await session.execute(
        select(SubscriptionCharge)
        .where(SubscriptionCharge.subscription_id == subscription_id)
        .order_by(SubscriptionCharge.occurred_on.desc())
    )
    return list(result.scalars().all())
