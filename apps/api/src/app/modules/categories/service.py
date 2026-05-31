from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.categories.models import Category, CategoryKind, CategoryRule

DEFAULT_TAXONOMY: list[dict[str, object]] = [
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


async def seed_categories(session: AsyncSession, household_id: uuid.UUID) -> None:
    existing = await session.execute(
        select(Category).where(Category.household_id == household_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        return

    for entry in DEFAULT_TAXONOMY:
        kind_str = str(entry.get("kind", "spending"))
        kind = CategoryKind(kind_str)
        parent = Category(
            household_id=household_id,
            name=str(entry["name"]),
            icon=str(entry["icon"]) if entry.get("icon") else None,
            color=str(entry["color"]) if entry.get("color") else None,
            is_system=True,
            kind=kind,
        )
        session.add(parent)
        await session.flush()

        children = entry.get("children", [])
        if isinstance(children, list):
            for child_entry in children:
                if not isinstance(child_entry, dict):
                    continue
                child = Category(
                    household_id=household_id,
                    parent_id=parent.id,
                    name=str(child_entry["name"]),
                    icon=str(child_entry["icon"]) if child_entry.get("icon") else None,
                    color=str(child_entry["color"])
                    if child_entry.get("color")
                    else None,
                    is_system=False,
                    kind=kind,
                )
                session.add(child)
        await session.flush()


async def create_category(
    session: AsyncSession,
    household_id: uuid.UUID,
    name: str,
    kind: CategoryKind,
    parent_id: uuid.UUID | None = None,
    icon: str | None = None,
    color: str | None = None,
) -> Category:
    cat = Category(
        household_id=household_id,
        parent_id=parent_id,
        name=name,
        icon=icon,
        color=color,
        is_system=False,
        kind=kind,
    )
    session.add(cat)
    await session.flush()
    return cat


async def delete_category(
    session: AsyncSession, category_id: uuid.UUID, household_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(Category).where(
            Category.id == category_id,
            Category.household_id == household_id,
            Category.is_system == False,  # noqa: E712
        )
    )
    cat = result.scalar_one_or_none()
    if cat is None:
        return False
    await session.delete(cat)
    await session.flush()
    return True


async def list_categories(
    session: AsyncSession, household_id: uuid.UUID
) -> list[Category]:
    result = await session.execute(
        select(Category)
        .where(
            or_(
                Category.household_id == household_id,
                Category.household_id.is_(None),
            )
        )
        .order_by(Category.is_system.desc(), Category.name)
    )
    return list(result.scalars().all())


async def get_category_tree(
    session: AsyncSession, household_id: uuid.UUID
) -> list[dict[str, object]]:
    categories = await list_categories(session, household_id)
    by_id: dict[uuid.UUID, dict[str, object]] = {}
    roots: list[dict[str, object]] = []

    for cat in categories:
        node: dict[str, object] = {
            "id": cat.id,
            "household_id": cat.household_id,
            "parent_id": cat.parent_id,
            "name": cat.name,
            "icon": cat.icon,
            "color": cat.color,
            "is_system": cat.is_system,
            "kind": cat.kind,
            "created_at": cat.created_at,
            "children": [],
        }
        by_id[cat.id] = node

    for cat in categories:
        node = by_id[cat.id]
        if cat.parent_id is not None and cat.parent_id in by_id:
            children = by_id[cat.parent_id]["children"]
            if isinstance(children, list):
                children.append(node)
        else:
            roots.append(node)

    return roots


async def list_rules(
    session: AsyncSession, household_id: uuid.UUID
) -> list[CategoryRule]:
    result = await session.execute(
        select(CategoryRule).where(CategoryRule.household_id == household_id)
    )
    return list(result.scalars().all())


async def create_rule(
    session: AsyncSession,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    pattern: str,
    category_id: uuid.UUID,
    match_type: str,
) -> CategoryRule:
    rule = CategoryRule(
        household_id=household_id,
        pattern=pattern,
        match_type=match_type,
        category_id=category_id,
        created_by_user_id=user_id,
    )
    session.add(rule)
    await session.flush()
    return rule


async def upsert_rule(
    session: AsyncSession,
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    pattern: str,
    category_id: uuid.UUID,
) -> CategoryRule:
    result = await session.execute(
        select(CategoryRule).where(
            CategoryRule.household_id == household_id,
            CategoryRule.pattern == pattern,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is not None:
        rule.category_id = category_id
        await session.flush()
        return rule
    new_rule = CategoryRule(
        household_id=household_id,
        pattern=pattern,
        match_type="substring",
        category_id=category_id,
        created_by_user_id=user_id,
    )
    session.add(new_rule)
    await session.flush()
    return new_rule


async def delete_rule(
    session: AsyncSession, rule_id: uuid.UUID, household_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(CategoryRule).where(
            CategoryRule.id == rule_id,
            CategoryRule.household_id == household_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        return False
    await session.delete(rule)
    await session.flush()
    return True


async def delete_rule_by_merchant(
    session: AsyncSession,
    household_id: uuid.UUID,
    pattern: str,
) -> bool:
    result = await session.execute(
        select(CategoryRule).where(
            CategoryRule.household_id == household_id,
            CategoryRule.pattern == pattern,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        return False
    await session.delete(rule)
    await session.flush()
    return True


def apply_rules(rules: list[CategoryRule], merchant_clean: str) -> CategoryRule | None:
    merchant_lower = merchant_clean.lower()
    for rule in rules:
        if rule.pattern.lower() in merchant_lower:
            return rule
    return None
