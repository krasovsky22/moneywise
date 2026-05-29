from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.cards.dependencies import get_card_or_404, get_household_id
from app.modules.cards.models import Card
from app.modules.cards.schemas import CardCreate, CardResponse, CardUpdate
from app.modules.cards.service import (
    archive_card,
    create_card,
    list_cards,
    unarchive_card,
    update_card,
)

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("", response_model=list[CardResponse])
async def list_cards_route(
    include_archived: bool = False,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> list[Card]:
    return await list_cards(db, household_id, include_archived)


@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card_route(
    body: CardCreate,
    household_id: uuid.UUID = Depends(get_household_id),
    db: AsyncSession = Depends(get_db),
) -> Card:
    return await create_card(db, household_id, body)


@router.get("/{card_id}", response_model=CardResponse)
async def get_card_route(
    card: Card = Depends(get_card_or_404),
) -> Card:
    return card


@router.patch("/{card_id}", response_model=CardResponse)
async def update_card_route(
    body: CardUpdate,
    card: Card = Depends(get_card_or_404),
    db: AsyncSession = Depends(get_db),
) -> Card:
    return await update_card(db, card, body)


@router.post("/{card_id}/archive", response_model=CardResponse)
async def archive_card_route(
    card: Card = Depends(get_card_or_404),
    db: AsyncSession = Depends(get_db),
) -> Card:
    return await archive_card(db, card)


@router.post("/{card_id}/unarchive", response_model=CardResponse)
async def unarchive_card_route(
    card: Card = Depends(get_card_or_404),
    db: AsyncSession = Depends(get_db),
) -> Card:
    return await unarchive_card(db, card)
