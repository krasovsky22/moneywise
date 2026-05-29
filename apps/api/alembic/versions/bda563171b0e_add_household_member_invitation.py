"""add_household_member_invitation

Revision ID: bda563171b0e
Revises: cb5a4f189c06
Create Date: 2026-05-28 14:44:15.965529

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bda563171b0e"
down_revision: str | Sequence[str] | None = "cb5a4f189c06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add display_name to existing users table
    op.add_column(
        "users", sa.Column("display_name", sa.String(length=255), nullable=True)
    )

    # Create households table (must exist before household_members and invitations)
    op.create_table(
        "households",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create household_members join table
    # composite PK, user_id unique = one household per user
    op.create_table(
        "household_members",
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["household_id"], ["households.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("household_id", "user_id"),
        sa.UniqueConstraint("user_id"),
    )

    # Create enum type then invitations table.
    # create_type=False prevents create_table from issuing a redundant CREATE TYPE;
    # the explicit .create(checkfirst=True) below is the single source of truth.
    invitationstatus = postgresql.ENUM(
        "pending",
        "accepted",
        "revoked",
        "expired",
        name="invitationstatus",
        create_type=False,
    )
    invitationstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "invitations",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", invitationstatus, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["household_id"], ["households.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
    )
    op.create_index(
        op.f("ix_invitations_email"), "invitations", ["email"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_invitations_email"), table_name="invitations")
    op.drop_table("invitations")
    postgresql.ENUM(name="invitationstatus", create_type=False).drop(
        op.get_bind(), checkfirst=True
    )
    op.drop_table("household_members")
    op.drop_table("households")
    op.drop_column("users", "display_name")
