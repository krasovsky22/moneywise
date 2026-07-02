"""seed qa agent account

Revision ID: e4a18b2f9af0
Revises: afa98176b368
Create Date: 2026-07-02 16:00:00.000000

Seeds a dedicated household + user reserved for AI QA agents (the
qa-playwright sub-agent and generated Playwright specs). Runs on every
`alembic upgrade head` — idempotent, and re-asserts sandbox mode + the
known password each run so the account never drifts out of a usable
state. See docs/testing/qa-agent-account.md.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from passlib.context import CryptContext

from alembic import op

revision: str = "e4a18b2f9af0"
down_revision: str | Sequence[str] | None = "afa98176b368"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

QA_EMAIL = "qa-agent@moneywise.dev"
QA_PASSWORD = "QaAgent!Sandbox2026"
QA_HOUSEHOLD_NAME = "QA Agent Household"

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    conn = op.get_bind()

    user_id = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": QA_EMAIL},
    ).scalar()

    hashed_password = _pwd_context.hash(QA_PASSWORD)

    if user_id is None:
        user_id = conn.execute(
            sa.text(
                "INSERT INTO users "
                "(id, email, hashed_password, is_active, created_at, updated_at) "
                "VALUES (gen_random_uuid(), :email, :hashed_password, TRUE, now(), now()) "
                "RETURNING id"
            ),
            {"email": QA_EMAIL, "hashed_password": hashed_password},
        ).scalar()
    else:
        # Re-assert the known password every run so the account can never
        # drift into an unusable state for agents relying on it.
        conn.execute(
            sa.text("UPDATE users SET hashed_password = :hashed_password WHERE id = :id"),
            {"hashed_password": hashed_password, "id": user_id},
        )

    household_id = conn.execute(
        sa.text(
            "SELECT h.id FROM households h "
            "JOIN household_members hm ON hm.household_id = h.id "
            "WHERE hm.user_id = :user_id"
        ),
        {"user_id": user_id},
    ).scalar()

    if household_id is None:
        household_id = conn.execute(
            sa.text(
                "INSERT INTO households (id, name, is_plaid_sandbox, created_at) "
                "VALUES (gen_random_uuid(), :name, TRUE, now()) "
                "RETURNING id"
            ),
            {"name": QA_HOUSEHOLD_NAME},
        ).scalar()
        conn.execute(
            sa.text(
                "INSERT INTO household_members (household_id, user_id, role, joined_at) "
                "VALUES (:household_id, :user_id, 'head', now())"
            ),
            {"household_id": household_id, "user_id": user_id},
        )
    else:
        # Always sandbox — never let this household point at real bank data.
        conn.execute(
            sa.text(
                "UPDATE households SET is_plaid_sandbox = TRUE WHERE id = :id"
            ),
            {"id": household_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM households WHERE id = ("
            "  SELECT h.id FROM households h "
            "  JOIN household_members hm ON hm.household_id = h.id "
            "  JOIN users u ON u.id = hm.user_id "
            "  WHERE u.email = :email"
            ")"
        ),
        {"email": QA_EMAIL},
    )
    conn.execute(sa.text("DELETE FROM users WHERE email = :email"), {"email": QA_EMAIL})
