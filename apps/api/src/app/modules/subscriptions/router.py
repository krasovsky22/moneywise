from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.subscriptions.dependencies import (
    get_household_id,
    get_subscription_or_404,
)
from app.modules.subscriptions.detection import detect_subscriptions
from app.modules.subscriptions.models import Subscription, SubscriptionStatus
from app.modules.subscriptions.schemas import (
    DetectionRunResponse,
    SubscriptionChargeResponse,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.modules.subscriptions.service import (
    confirm_subscription,
    create_manual_subscription,
    delete_subscription,
    dismiss_subscription,
    list_charges,
    list_subscriptions,
    update_subscription,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("", response_model=list[SubscriptionResponse])
async def list_subscriptions_route(
    status_filter: SubscriptionStatus | None = None,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[Subscription]:
    return await list_subscriptions(db, household_id, status_filter)


@router.post(
    "",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_subscription_route(
    body: SubscriptionCreate,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    return await create_manual_subscription(db, household_id, body)


@router.post("/detect", response_model=DetectionRunResponse)
async def detect_subscriptions_route(
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> DetectionRunResponse:
    result = await detect_subscriptions(db, household_id)
    return DetectionRunResponse(
        created=result.created,
        updated=result.updated,
        charges_linked=result.charges_linked,
    )


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription_route(
    subscription: Subscription = Depends(get_subscription_or_404),
) -> Subscription:
    return subscription


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription_route(
    body: SubscriptionUpdate,
    subscription: Subscription = Depends(get_subscription_or_404),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    return await update_subscription(db, subscription, body)


@router.delete("/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription_route(
    subscription: Subscription = Depends(get_subscription_or_404),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_subscription(db, subscription)


@router.post("/{subscription_id}/confirm", response_model=SubscriptionResponse)
async def confirm_subscription_route(
    subscription: Subscription = Depends(get_subscription_or_404),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    return await confirm_subscription(db, subscription)


@router.post("/{subscription_id}/dismiss", response_model=SubscriptionResponse)
async def dismiss_subscription_route(
    subscription: Subscription = Depends(get_subscription_or_404),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    return await dismiss_subscription(db, subscription)


@router.get(
    "/{subscription_id}/charges",
    response_model=list[SubscriptionChargeResponse],
)
async def list_charges_route(
    subscription: Subscription = Depends(get_subscription_or_404),
    db: AsyncSession = Depends(get_db),
) -> list[SubscriptionChargeResponse]:
    charges = await list_charges(db, subscription.id)
    return [SubscriptionChargeResponse.model_validate(c) for c in charges]
