from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Health check endpoint. Returns API status and version."""
    return {"status": "ok", "version": settings.APP_VERSION}
