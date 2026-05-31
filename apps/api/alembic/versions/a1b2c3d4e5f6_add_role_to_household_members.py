"""add_role_to_household_members

Revision ID: a1b2c3d4e5f6
Revises: 76d03a4c761b
Create Date: 2026-05-31 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "76d03a4c761b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    householdmemberrole = postgresql.ENUM(
        "head",
        "member",
        name="householdmemberrole",
        create_type=False,
    )
    householdmemberrole.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "household_members",
        sa.Column(
            "role",
            postgresql.ENUM(
                "head", "member", name="householdmemberrole", create_type=False
            ),
            nullable=False,
            server_default="member",
        ),
    )
    # Remove the server default so future inserts must supply the value explicitly
    op.alter_column("household_members", "role", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("household_members", "role")
    postgresql.ENUM(name="householdmemberrole", create_type=False).drop(
        op.get_bind(), checkfirst=True
    )
