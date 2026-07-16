# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MoneyWise — a household personal-finance app. Users connect banks via Plaid, transactions sync automatically, get categorized, and roll up into cashflow/"money left this cycle" views. Product specs live in `docs/product/` (roadmap + per-epic requirements); read the relevant epic before building a feature.

Note: the original PDF-statement-upload pipeline was replaced by Plaid bank sync (Epic F01); its code, tests, and docs have been removed. Epics 03/04 in `docs/product/epics/` are historical.

Design review notes and suggested UI updates: `docs/design/design-suggestions.md`. Running the dev server / browser MCP so AI agents can see logs: `docs/dev-ai-debugging.md`. Dedicated QA agent account (for Playwright specs and the `qa-playwright` sub-agent — AI agents only, never for humans): `docs/testing/qa-agent-account.md`.

## Commands

### Root (pnpm workspaces + Turborepo)
```bash
pnpm install          # Install JS deps + activate lefthook git hooks
pnpm dev              # Start API (:8000) + web (:3000) concurrently
pnpm build            # Production build
pnpm test             # All tests (pytest + Vitest via Turborepo)
pnpm lint             # Lint entire workspace
pnpm typecheck        # tsc strict + mypy strict
```

### Makefile shortcuts
```bash
make up / make down            # Start/stop Postgres + Redis (docker compose)
make migrate                   # alembic upgrade head
make migration MSG="..."       # alembic revision --autogenerate
make set-password EMAIL=...    # Set/reset a user password (CLI, prompts securely)
make reset-data EMAIL=... [YES=1]  # Delete all data for a user's household
```

### Backend (`apps/api`)
```bash
uv sync                                    # Install Python dependencies
uv run uvicorn app.main:app --reload       # Dev server (:8000)
uv run pytest                              # All tests
uv run pytest tests/test_auth.py           # Single test file
uv run pytest tests/test_auth.py -k name   # Single test
uv run ruff check . && uv run ruff format .
uv run mypy src/
uv run python -m app.cli --help            # Management CLI (Typer)
```

### Frontend (`apps/web`)
```bash
pnpm --filter web dev          # Dev server only
pnpm --filter web test         # Vitest unit tests
pnpm --filter web typecheck    # tsc --noEmit
```

### E2E (Playwright, repo root)
```bash
pnpm exec playwright test                        # Runs playwright-tests/ against http://localhost:3000
pnpm exec playwright test playwright-tests/auth.spec.ts
```
E2E tests need the full stack running (`make dev` or `pnpm dev` + docker compose). Config at root `playwright.config.ts` (single worker, chromium).

## Architecture

### Monorepo
```
apps/api          # FastAPI backend (Python 3.12, uv)
apps/web          # React 19 + Vite + TypeScript frontend
packages/shared-types  # Shared TS types (workspace:*)
docs/product      # Roadmap + epics (product source of truth)
playwright-tests  # Root-level E2E suites
```
Turborepo orchestrates JS tasks; `apps/api` is wired in via `uv run` scripts so root `pnpm` commands span both.

### Multi-tenancy: everything is household-scoped

The core data-isolation unit is the **household** (`modules/household`). Users belong to a household (with roles + invitations); cards, bank accounts, categories, and transactions all carry `household_id` and every service query filters by it. When adding features, scope new tables and queries by `household_id`, never by `user_id` alone.

### Backend (`apps/api/src/app/`)

- `core/` — Pydantic Settings (`config.py` — never read `os.environ` directly), async SQLAlchemy session (`database.py`), JWT (`security.py`), structlog
- `api/v1/router.py` — aggregates module routers under `/api/v1`
- `modules/<feature>/` — each feature owns `router.py` (thin), `schemas.py`, `models.py`, `service.py` (business logic), `dependencies.py`
- `common/` — shared exceptions (typed HTTP errors), base model
- `cli.py` — Typer management CLI reusing the same async DB session

Modules: `auth` (JWT access + refresh tokens), `users`, `household`, `cards` (credit cards + billing cycles), `bank_accounts`, `categories` (household + global system categories, rules), `transactions` (types: expense/income/transfer/refund; splits; change history), `plaid`, `subscriptions`.

**Plaid module** (`modules/plaid/`): `client.py` wraps the Plaid SDK, `crypto.py` encrypts access tokens at rest (Fernet — needs `PLAID_TOKEN_ENCRYPTION_KEY` in `.env`), `sync.py` does cursor-based incremental transaction sync, initial sync runs in-process via FastAPI `BackgroundTasks` (no worker). Sandbox login: `user_good` / `pass_good`.

**Subscriptions module** (`modules/subscriptions/`, Epic F05): `detection.py` heuristically detects recurring charges (same merchant + similar amount + regular cadence) and creates `pending_review` subscription candidates for the user to confirm or dismiss. Detection re-runs automatically after each Plaid sync.

**Adding a module:** create `modules/<name>/` with the five files → import models in `alembic/env.py` → register router in `api/v1/router.py` → `make migration MSG="..."` + `make migrate`.

All routes, sessions, and queries are async. Tests use pytest-asyncio in auto mode (no `@pytest.mark.asyncio` needed).

### Frontend (`apps/web/src/`)

- `routes/` — TanStack Router file-based routes. `secure.tsx` is the authenticated layout; app pages live under `routes/secure/` (dashboard, transactions, wallet, subscriptions, settings). `routeTree.gen.ts` is auto-generated — never edit.
- `features/<name>/` — per feature: `<name>Api.ts` (ky calls), `use<Name>.ts` (TanStack Query hooks), components
- `components/ui/` — shadcn/ui primitives only, no business logic
- `lib/api-client.ts` — ky instance; all API calls go through it (attaches auth, handles refresh)
- `lib/env.ts` — typed wrapper for `import.meta.env`; never access it raw
- `stores/auth.ts` — Zustand auth store

Vite dev proxy forwards `/api` → `http://localhost:8000`, so no CORS in dev. MSW mocks the API in Vitest tests (`tests/mocks/`).

### Request lifecycle
```
Browser → TanStack Query → api-client.ts (ky) → Vite proxy
→ FastAPI route → service → async SQLAlchemy → PostgreSQL
```

## Conventions

- Python fully type-annotated, `mypy --strict` clean; ruff for lint + format (line length 88)
- TypeScript strict; no `any` without a justifying comment
- Secrets in `.env` (gitignored); `.env.example` checked in. Plaid needs `PLAID_SANDBOX_CLIENT_ID`/`PLAID_SANDBOX_SECRET`, `PLAID_PROD_CLIENT_ID`/`PLAID_PROD_SECRET`, and `PLAID_TOKEN_ENCRYPTION_KEY` in `apps/api/.env`. There is no `PLAID_ENV` — sandbox vs production is a per-household flag (`Household.is_plaid_sandbox`, defaults to sandbox)
- lefthook pre-commit hooks run ruff on Python, ESLint/Prettier on TS
- FastAPI's OpenAPI spec (`/docs`) is the API contract source of truth
- CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, and tests for both apps, plus `alembic check` for migration drift — model changes must ship with a migration

## Agentic workflow

`.claude/agents/` defines `product-manager` (coordinates, never writes code), `api-backend` (owns `apps/api/`), `web-frontend` (owns `apps/web/`), and `qa-playwright` (browser-tests the live app at :3000). Use them when delegating feature work; delegate with the agent's name as `subagent_type` so its own system prompt is loaded.

This is the **only** orchestration system for this repo. The GSD framework (`/gsd:*` skills, `gsd-*` agents) is installed globally for other projects — do not initialize it here (no `.planning/` directory) or route moneywise work through its commands. Feature planning lives in `docs/product/epics/`; a feature is done when tests, typecheck, migrations, and a `qa-playwright` pass all succeed.
