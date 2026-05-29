from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Household(Base):
    __tablename__ = "households"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class HouseholdMember(Base):
    __tablename__ = "household_members"

    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (PrimaryKeyConstraint("household_id", "user_id"),)


class InvitationStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    revoked = "revoked"
    expired = "expired"


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    invited_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus, name="invitationstatus"),
        nullable=False,
        default=InvitationStatus.pending,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (UniqueConstraint("token_hash", name="uq_invitations_token_hash"),)
