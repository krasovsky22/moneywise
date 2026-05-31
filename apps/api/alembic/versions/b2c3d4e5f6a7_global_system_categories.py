"""global_system_categories

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-31 12:00:00.000000

Make household_id nullable on categories (NULL = global system category).
Inserts the default taxonomy once globally so every household sees it.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Canonical system taxonomy — keep in sync with categories/service.py
# ---------------------------------------------------------------------------
_TAXONOMY: list[dict] = [
    {
        "name": "Food & Drink",
        "icon": "🍽️",
        "color": "#f97316",
        "kind": "spending",
        "children": [
            {"name": "Groceries", "icon": "🛒", "color": "#f97316"},
            {"name": "Restaurants", "icon": "🍴", "color": "#f97316"},
            {"name": "Coffee", "icon": "☕", "color": "#f97316"},
            {"name": "Alcohol", "icon": "🍺", "color": "#f97316"},
        ],
    },
    {
        "name": "Transportation",
        "icon": "🚗",
        "color": "#6366f1",
        "kind": "spending",
        "children": [
            {"name": "Gas", "icon": "⛽", "color": "#6366f1"},
            {"name": "Rideshare", "icon": "🚕", "color": "#6366f1"},
            {"name": "Transit", "icon": "🚌", "color": "#6366f1"},
            {"name": "Parking", "icon": "🅿️", "color": "#6366f1"},
            {"name": "Tolls", "icon": "🛣️", "color": "#6366f1"},
            {"name": "Auto Maintenance", "icon": "🔧", "color": "#6366f1"},
        ],
    },
    {
        "name": "Housing",
        "icon": "🏠",
        "color": "#0ea5e9",
        "kind": "spending",
        "children": [
            {"name": "Rent/Mortgage", "icon": "🏡", "color": "#0ea5e9"},
            {"name": "Utilities", "icon": "💡", "color": "#0ea5e9"},
            {"name": "Internet", "icon": "📡", "color": "#0ea5e9"},
            {"name": "Home Maintenance", "icon": "🔨", "color": "#0ea5e9"},
            {"name": "HOA", "icon": "🏘️", "color": "#0ea5e9"},
        ],
    },
    {
        "name": "Health",
        "icon": "❤️",
        "color": "#ef4444",
        "kind": "spending",
        "children": [
            {"name": "Pharmacy", "icon": "💊", "color": "#ef4444"},
            {"name": "Doctor", "icon": "🩺", "color": "#ef4444"},
            {"name": "Insurance", "icon": "🛡️", "color": "#ef4444"},
            {"name": "Fitness", "icon": "🏋️", "color": "#ef4444"},
        ],
    },
    {
        "name": "Shopping",
        "icon": "🛍️",
        "color": "#8b5cf6",
        "kind": "spending",
        "children": [
            {"name": "Clothing", "icon": "👕", "color": "#8b5cf6"},
            {"name": "Electronics", "icon": "📱", "color": "#8b5cf6"},
            {"name": "Home Goods", "icon": "🛋️", "color": "#8b5cf6"},
            {"name": "General", "icon": "📦", "color": "#8b5cf6"},
        ],
    },
    {
        "name": "Entertainment",
        "icon": "🎮",
        "color": "#ec4899",
        "kind": "spending",
        "children": [
            {"name": "Streaming", "icon": "📺", "color": "#ec4899"},
            {"name": "Events", "icon": "🎭", "color": "#ec4899"},
            {"name": "Hobbies", "icon": "🎨", "color": "#ec4899"},
            {"name": "Books/Media", "icon": "📚", "color": "#ec4899"},
        ],
    },
    {
        "name": "Travel",
        "icon": "✈️",
        "color": "#14b8a6",
        "kind": "spending",
        "children": [
            {"name": "Flights", "icon": "🛫", "color": "#14b8a6"},
            {"name": "Hotels", "icon": "🏨", "color": "#14b8a6"},
            {"name": "Transport", "icon": "🚂", "color": "#14b8a6"},
            {"name": "Other", "icon": "🌍", "color": "#14b8a6"},
        ],
    },
    {
        "name": "Personal Care",
        "icon": "💆",
        "color": "#f59e0b",
        "kind": "spending",
        "children": [
            {"name": "Salon", "icon": "💇", "color": "#f59e0b"},
            {"name": "Toiletries", "icon": "🧴", "color": "#f59e0b"},
            {"name": "Self-care", "icon": "🧘", "color": "#f59e0b"},
        ],
    },
    {
        "name": "Kids & Family",
        "icon": "👶",
        "color": "#22c55e",
        "kind": "spending",
        "children": [
            {"name": "Childcare", "icon": "🧒", "color": "#22c55e"},
            {"name": "Education", "icon": "📖", "color": "#22c55e"},
            {"name": "Activities", "icon": "⚽", "color": "#22c55e"},
        ],
    },
    {
        "name": "Financial",
        "icon": "💰",
        "color": "#64748b",
        "kind": "transfer",
        "children": [
            {"name": "Fees", "icon": "💳", "color": "#64748b"},
            {"name": "Interest", "icon": "📈", "color": "#64748b"},
            {"name": "Transfers", "icon": "↔️", "color": "#64748b"},
        ],
    },
    {
        "name": "Gifts & Donations",
        "icon": "🎁",
        "color": "#f43f5e",
        "kind": "spending",
        "children": [],
    },
    {
        "name": "Other",
        "icon": "❓",
        "color": "#94a3b8",
        "kind": "spending",
        "children": [],
    },
]


def upgrade() -> None:
    # Make household_id nullable so global (system) categories can have NULL
    op.alter_column("categories", "household_id", existing_type=sa.Uuid(), nullable=True)

    conn = op.get_bind()

    # Skip if global system categories already seeded
    existing = conn.execute(
        sa.text("SELECT COUNT(*) FROM categories WHERE household_id IS NULL")
    ).scalar()
    if existing and existing > 0:
        return

    for entry in _TAXONOMY:
        kind = entry.get("kind", "spending")
        parent_id = conn.execute(sa.text("SELECT gen_random_uuid()")).scalar()
        conn.execute(
            sa.text(
                "INSERT INTO categories (id, household_id, parent_id, name, icon, color, is_system, kind) "
                "VALUES (:id, NULL, NULL, :name, :icon, :color, TRUE, CAST(:kind AS categorykind))"
            ),
            {"id": str(parent_id), "name": entry["name"], "icon": entry.get("icon"), "color": entry.get("color"), "kind": kind},
        )
        for child in entry.get("children", []):
            child_id = conn.execute(sa.text("SELECT gen_random_uuid()")).scalar()
            conn.execute(
                sa.text(
                    "INSERT INTO categories (id, household_id, parent_id, name, icon, color, is_system, kind) "
                    "VALUES (:id, NULL, :parent_id, :name, :icon, :color, TRUE, CAST(:kind AS categorykind))"
                ),
                {"id": str(child_id), "parent_id": str(parent_id), "name": child["name"], "icon": child.get("icon"), "color": child.get("color"), "kind": kind},
            )


def downgrade() -> None:
    # Remove global system categories
    op.execute("DELETE FROM categories WHERE household_id IS NULL")
    # Restore NOT NULL constraint (will fail if any NULLs remain)
    op.alter_column("categories", "household_id", existing_type=sa.Uuid(), nullable=False)
