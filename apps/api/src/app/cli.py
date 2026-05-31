"""Management CLI for moneywise API."""

from __future__ import annotations

import asyncio
import getpass
import sys

import typer
from sqlalchemy import delete, func, select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.modules.household.models import HouseholdMember
from app.modules.statements.models import Statement
from app.modules.transactions.models import Transaction
from app.modules.users.models import User

app = typer.Typer(help="Moneywise management commands.")


@app.callback()
def _callback() -> None:
    """Moneywise management commands."""


@app.command()
def set_password(
    email: str = typer.Argument(..., help="User email address"),
    password: str = typer.Option(
        None,
        "--password",
        "-p",
        help="New password (prompted securely if omitted)",
    ),
) -> None:
    """Set or reset a user's password by email."""

    if not password:
        password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            typer.echo("Passwords do not match.", err=True)
            raise typer.Exit(code=1)

    if not password:
        typer.echo("Password cannot be empty.", err=True)
        raise typer.Exit(code=1)

    asyncio.run(_set_password(email, password))


async def _set_password(email: str, password: str) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            typer.echo(f"No user found with email: {email}", err=True)
            sys.exit(1)

        user.hashed_password = get_password_hash(password)
        await session.commit()

    typer.echo(f"Password updated for {email}.")


@app.command()
def reset_data(
    email: str = typer.Argument(..., help="User email address"),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt"),
) -> None:
    """Delete all statements and transactions for the user's household."""
    asyncio.run(_reset_data(email, yes))


async def _reset_data(email: str, confirmed: bool) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            typer.echo(f"No user found with email: {email}", err=True)
            sys.exit(1)

        member = await session.execute(
            select(HouseholdMember).where(HouseholdMember.user_id == user.id)
        )
        hm = member.scalar_one_or_none()
        if hm is None:
            typer.echo(f"User {email} is not a member of any household.", err=True)
            sys.exit(1)

        household_id = hm.household_id

        txn_count = await session.scalar(
            select(func.count()).where(Transaction.household_id == household_id)
        )
        stmt_count = await session.scalar(
            select(func.count()).where(Statement.household_id == household_id)
        )

        typer.echo(
            f"Household {household_id}: {stmt_count} statement(s), "
            f"{txn_count} transaction(s) will be deleted."
        )

        if not confirmed:
            typer.confirm("Proceed?", abort=True)

        await session.execute(
            delete(Transaction).where(Transaction.household_id == household_id)
        )
        await session.execute(
            delete(Statement).where(Statement.household_id == household_id)
        )
        await session.commit()

    typer.echo("Done.")


if __name__ == "__main__":
    app()
