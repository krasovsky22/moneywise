from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import health
from app.modules.auth.router import router as auth_router
from app.modules.bank_accounts.router import router as bank_accounts_router
from app.modules.cards.router import router as cards_router
from app.modules.categories.router import router as categories_router
from app.modules.household.router import router as household_router
from app.modules.plaid.router import router as plaid_router
from app.modules.transactions.router import router as transactions_router
from app.modules.users.router import router as users_router

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(household_router)
api_v1_router.include_router(cards_router)
api_v1_router.include_router(bank_accounts_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(transactions_router)
api_v1_router.include_router(plaid_router)
