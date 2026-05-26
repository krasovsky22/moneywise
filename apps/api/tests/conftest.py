from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """In-process async test client — no real HTTP connections needed."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Database fixtures
# NullPool avoids asyncpg pool connections being bound to a stale event loop.
# ---------------------------------------------------------------------------

_test_engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
)
_TestSessionLocal = async_sessionmaker(
    _test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "db: mark test as requiring a live PostgreSQL database",
    )


@pytest.fixture(scope="session")
async def create_test_tables() -> AsyncGenerator[None, None]:
    """Create all tables once per session; skip if DB is not available."""
    try:
        async with _test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except (OperationalError, OSError, Exception) as exc:
        pytest.skip(f"PostgreSQL not available — skipping DB-dependent tests: {exc}")
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
async def truncate_tables(create_test_tables: None) -> AsyncGenerator[None, None]:
    """Truncate all data tables before each test for isolation."""
    yield
    async with _test_engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE TABLE refresh_tokens, users RESTART IDENTITY CASCADE")
        )


@pytest.fixture
async def db_session(create_test_tables: None) -> AsyncGenerator[AsyncSession, None]:
    """Async session for direct DB manipulation in tests."""
    async with _TestSessionLocal() as session:
        yield session


@pytest.fixture
async def db_client(
    create_test_tables: None,
) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client whose requests hit the real DB (no mocking)."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with _TestSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)
