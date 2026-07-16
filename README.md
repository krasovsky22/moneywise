# MoneyWise

Household personal-finance app: connect banks via Plaid, transactions sync and categorize automatically, and roll up into cashflow views. Product specs live in `docs/product/`.

## Architecture

```
moneywise/
├── apps/
│   ├── api/          # Python FastAPI backend (:8000)
│   └── web/          # React 19 + Vite + TypeScript frontend (:3000)
├── packages/
│   └── shared-types/ # Shared TypeScript interfaces
├── docker-compose.yml
└── Makefile
```

**Data flow:**

```
Browser → TanStack Query → api-client.ts → Vite proxy
→ FastAPI route → service → async SQLAlchemy → PostgreSQL
```

## Prerequisites

| Tool           | Version | Install                                                       |
| -------------- | ------- | ------------------------------------------------------------- |
| Node.js        | 22+     | `nvm install 22` or [nodejs.org](https://nodejs.org)          |
| pnpm           | 10+     | `corepack enable && corepack prepare pnpm@latest --activate`  |
| uv             | latest  | `curl -LsSf https://astral.sh/uv/install.sh \| sh`            |
| Docker Desktop | latest  | [docker.com](https://www.docker.com/products/docker-desktop/) |

> **WSL2 users:** Enable Docker Desktop's WSL2 integration in Settings → Resources → WSL Integration.

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url> moneywise && cd moneywise
pnpm install          # installs JS deps + activates lefthook git hooks
cd apps/api && uv sync && cd ../..   # installs Python deps

# 2. Configure environment
cp .env.example .env
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and set a real SECRET_KEY:
#   openssl rand -hex 32

# 3. Start database + Redis
docker compose up -d

# 4. Run database migrations
make migrate

# 5. Start development servers
pnpm dev
```

Visit:

- **Frontend:** http://localhost:3000 — sign up, then dashboard / transactions / wallet / subscriptions under `/secure/*`
- **API docs:** http://localhost:8000/docs — FastAPI OpenAPI UI
- **API health:** http://localhost:8000/api/v1/health

## Common Commands

| Command                       | Description                     |
| ----------------------------- | ------------------------------- |
| `pnpm dev`                    | Start API + web concurrently    |
| `pnpm test`                   | Run all tests (pytest + Vitest) |
| `pnpm lint`                   | Lint all packages               |
| `pnpm typecheck`              | TypeScript + mypy strict check  |
| `pnpm build`                  | Production build                |
| `make up` / `make down`       | Start / stop Docker services    |
| `make migrate`                | Apply pending DB migrations     |
| `make migration MSG="..."`    | Create a new migration          |
| `make logs`                   | Tail Docker logs                |
| `make set-password EMAIL=...` | Set or reset a user's password  |
| `make reset-data EMAIL=...`   | Delete all transactions for a user's household               |

## Running Services Individually

Use separate terminals when you only need one service or want isolated logs.

```bash
# Infrastructure only (Postgres + Redis)
docker compose up -d

# API server only (hot-reload)
cd apps/api
uv run uvicorn app.main:app --reload --port 8000

# Web dev server only
pnpm --filter web dev

# Run in background (logs to file)
uv run uvicorn app.main:app --reload --port 8000 > /tmp/api.log 2>&1 &
pnpm --filter web dev > /tmp/web.log 2>&1 &
```

## Plaid Integration

MoneyWise integrates with [Plaid](https://plaid.com) to automatically sync transactions from banks and credit cards. Users connect an institution once via Plaid Link; the system maintains the connection and pulls new transactions incrementally using a cursor-based sync.

**Required env vars** (add to `apps/api/.env`; see `apps/api/.env.example`):

| Variable                     | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `PLAID_SANDBOX_CLIENT_ID`    | Sandbox credentials from [Plaid Dashboard](https://dashboard.plaid.com) |
| `PLAID_SANDBOX_SECRET`       | Sandbox secret                                                   |
| `PLAID_PROD_CLIENT_ID`       | Production credentials (optional until going live)               |
| `PLAID_PROD_SECRET`          | Production secret                                                |
| `PLAID_TOKEN_ENCRYPTION_KEY` | Fernet key — generate with the command below. If unset, access tokens are stored in **plaintext** |

There is no `PLAID_ENV` — sandbox vs production is a per-household flag (`Household.is_plaid_sandbox`, defaults to sandbox).

```bash
# Generate encryption key (run once, store in .env, never commit)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Sandbox testing:** use `user_good` / `pass_good` — no real bank credentials required.

**Architecture:** `apps/api/src/app/modules/plaid/` — `client.py` wraps the Plaid SDK, `crypto.py` encrypts access tokens at rest (Fernet/AES-256), `sync.py` runs cursor-based transaction sync, `router.py` exposes the HTTP endpoints.

**Frontend:** `apps/web/src/features/plaid/` — `PlaidLinkButton` opens the Plaid modal, `ConnectedAccountsSection` on the Wallet page lists linked institutions with status badges, refresh, and disconnect actions.

**Background tasks:** initial sync after account connection runs via FastAPI `BackgroundTasks` (in-process, no separate worker needed).

## Background / Worker Commands

All background processing (initial Plaid sync after connection, subscription detection after each sync) runs in-process via FastAPI `BackgroundTasks`. There is no separate worker or job queue; sync happens on connect or via the manual re-sync button.

## Management CLI

The API ships a management CLI for administrative tasks that shouldn't go through the HTTP API.

```bash
# Set / reset a password — prompts securely, nothing in shell history (recommended)
make set-password EMAIL=user@example.com

# Pass password directly (useful in CI/scripts)
make set-password EMAIL=user@example.com PASSWORD=newpassword

# Delete all data for a user's household (prompts for confirmation)
make reset-data EMAIL=user@example.com

# Skip the confirmation prompt (useful in scripts)
make reset-data EMAIL=user@example.com YES=1

# Or invoke uv directly for the full --help output
cd apps/api
uv run python -m app.cli --help
uv run python -m app.cli reset-data --help
```

> The CLI reuses the same async DB session and bcrypt hashing as the API, so it works against any environment that has `DATABASE_URL` set in `apps/api/.env`.

## Adding a new API module

1. Create `apps/api/src/app/modules/<name>/` with: `router.py`, `schemas.py`, `models.py`, `service.py`, `dependencies.py`
2. Import the models in `apps/api/alembic/env.py`
3. Register the router in `apps/api/src/app/api/v1/router.py`
4. Generate + apply a migration: `make migration MSG="add <name>"` then `make migrate`

## Adding a new frontend route

1. Create `apps/web/src/routes/<name>.tsx` with `export const Route = createFileRoute("/<name>")()`
2. TanStack Router's Vite plugin auto-regenerates `routeTree.gen.ts` on next `vite dev` start

> **Note:** `src/routeTree.gen.ts` is auto-generated — never edit it manually.

## Tech Stack

**Backend:** FastAPI · Pydantic v2 · SQLAlchemy 2.0 async · Alembic · structlog · uv

**Frontend:** React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Zustand · Tailwind CSS · shadcn/ui · ky · Vitest · MSW

**Infra:** PostgreSQL 16 · Redis 7 · Docker Compose · GitHub Actions · Turborepo · lefthook

## Claude Code Agents

This project ships four Claude Code sub-agents in `.claude/agents/`: `product-manager` (coordinates feature work), `api-backend` (owns `apps/api/`), `web-frontend` (owns `apps/web/`), and `qa-playwright` (browser-tests the live app). The agent files themselves and the "Agentic workflow" section of [CLAUDE.md](CLAUDE.md) are the source of truth for how they operate — this README intentionally doesn't duplicate them.

### Debugging with AI agents

To let agents see dev-server logs and browser DevTools output (console errors, failed network requests) while troubleshooting, see [docs/dev-ai-debugging.md](docs/dev-ai-debugging.md). Short version: have Claude start `pnpm dev` as a background task (it captures all output), or pipe your own terminal through `tee` to a log file; for browser bugs, agents drive Playwright/Chrome DevTools via MCP, and `google-chrome --remote-debugging-port=9222` lets them attach to your own Chrome session.

## Database (Cloud)

For cloud deployment, use **[Neon](https://neon.tech)** (free tier: 10 GB, no idle pausing, database branching). Set `DATABASE_URL` in your deployment environment to the Neon connection string.
