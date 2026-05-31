"""Management CLI for moneywise API."""

from __future__ import annotations

import asyncio
import getpass
import sys

import typer
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
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


if __name__ == "__main__":
    app()
