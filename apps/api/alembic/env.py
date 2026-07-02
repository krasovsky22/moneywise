import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Make src/ importable from alembic context
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from app.core.config import settings
from app.core.database import Base

# Import all model modules so Alembic autogenerate can detect table changes.
# Add new model imports here whenever a new module is created.
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.bank_accounts import models as bank_accounts_models  # noqa: F401
from app.modules.cards import models as cards_models  # noqa: F401
from app.modules.categories import models as categories_models  # noqa: F401
from app.modules.household import models as household_models  # noqa: F401
from app.modules.plaid import models as plaid_models  # noqa: F401
from app.modules.subscriptions import models as subscriptions_models  # noqa: F401
from app.modules.transactions import models as transactions_models  # noqa: F401
from app.modules.users import models as users_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (emit SQL to stdout)."""
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: object) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)  # type: ignore[arg-type]
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations with an async engine."""
    connectable = create_async_engine(settings.DATABASE_URL)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
