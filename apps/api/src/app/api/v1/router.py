from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import health
from app.modules.auth.router import router as auth_router
from app.modules.household.router import router as household_router
from app.modules.users.router import router as users_router

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(household_router)
