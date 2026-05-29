from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cards.models import Card
from app.modules.cards.schemas import CardCreate, CardUpdate


async def list_cards(
    session: AsyncSession,
    household_id: uuid.UUID,
    include_archived: bool = False,
) -> list[Card]:
    stmt = select(Card).where(Card.household_id == household_id)
    if not include_archived:
        stmt = stmt.where(Card.is_archived.is_(False))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_card(
    session: AsyncSession,
    card_id: uuid.UUID,
    household_id: uuid.UUID,
) -> Card | None:
    result = await session.execute(
        select(Card).where(Card.id == card_id, Card.household_id == household_id)
    )
    return result.scalar_one_or_none()


async def _clear_default(session: AsyncSession, household_id: uuid.UUID) -> None:
    await session.execute(
        update(Card)
        .where(Card.household_id == household_id, Card.is_default.is_(True))
        .values(is_default=False)
    )


async def create_card(
    session: AsyncSession,
    household_id: uuid.UUID,
    data: CardCreate,
) -> Card:
    if data.is_default:
        await _clear_default(session, household_id)

    card = Card(
        household_id=household_id,
        nickname=data.nickname,
        issuer=data.issuer,
        last4=data.last4,
        network=data.network,
        color=data.color,
        icon=data.icon,
        statement_close_day=data.statement_close_day,
        payment_due_day=data.payment_due_day,
        minimum_payment_cents=data.minimum_payment_cents,
        is_shared=data.is_shared,
        is_default=data.is_default,
    )
    session.add(card)
    await session.flush()
    return card


async def update_card(
    session: AsyncSession,
    card: Card,
    data: CardUpdate,
) -> Card:
    if data.is_default is True:
        await _clear_default(session, card.household_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)

    await session.flush()
    return card


async def archive_card(session: AsyncSession, card: Card) -> Card:
    card.is_archived = True
    card.archived_at = datetime.now(UTC)
    await session.flush()
    return card


async def unarchive_card(session: AsyncSession, card: Card) -> Card:
    card.is_archived = False
    card.archived_at = None
    await session.flush()
    return card
