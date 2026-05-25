from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.logging import configure_logging

# Configure logging before anything else logs
configure_logging(settings.ENVIRONMENT)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle (startup / shutdown)."""
    logger.info(
        "Starting MoneyWise API",
        version=settings.APP_VERSION,
        env=settings.ENVIRONMENT,
    )
    yield
    logger.info("Shutting down MoneyWise API")


app = FastAPI(
    title="MoneyWise API",
    version=settings.APP_VERSION,
    description="Personal finance management API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes — versioned under /api/v1
app.include_router(api_v1_router, prefix="/api/v1")
