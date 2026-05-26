# MoneyWise

Personal finance management app — monorepo scaffold.

## Architecture

```
moneywise/
├── apps/
│   ├── api/          # Python FastAPI backend (:8000)
│   └── web/          # React 19 + Vite + TypeScript frontend (:5173)
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

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | `nvm install 22` or [nodejs.org](https://nodejs.org) |
| pnpm | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker Desktop | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |

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
- **Frontend:** http://localhost:5173 — shows API health status
- **API docs:** http://localhost:8000/docs — FastAPI OpenAPI UI
- **API health:** http://localhost:8000/api/v1/health

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web concurrently |
| `pnpm test` | Run all tests (pytest + Vitest) |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript + mypy strict check |
| `pnpm build` | Production build |
| `make up` / `make down` | Start / stop Docker services |
| `make migrate` | Apply pending DB migrations |
| `make migration MSG="..."` | Create a new migration |
| `make logs` | Tail Docker logs |

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

This project ships three Claude Code sub-agents in `.claude/agents/`. Invoke them by name when delegating work inside Claude Code.

### `product-manager`
**Role:** Feature coordinator — no code, only analysis and delegation.

Workflow for any feature request:
1. Audits the codebase to understand current state
2. Defines acceptance criteria and identifies gaps
3. Splits work into backend and frontend tracks
4. Delegates to `api-backend` and/or `web-frontend` (in parallel when independent, sequentially when frontend depends on a backend contract)
5. Verifies completion against acceptance criteria and re-delegates if anything is missing

May write planning docs under `.planning/`. Never touches `apps/`.

---

### `api-backend`
**Role:** Python FastAPI professional — owns everything in `apps/api/`.

Responsibilities:
- FastAPI routes, services, schemas, ORM models
- Alembic migrations
- Async SQLAlchemy sessions and dependency injection
- pytest tests, mypy strict, ruff lint/format

Key constraints: all DB/route code is async; route handlers are thin (delegate to a service); never access `os.environ` directly — use Pydantic Settings.

---

### `web-frontend`
**Role:** React UI developer — owns everything in `apps/web/`.

Responsibilities:
- TanStack Router file-based routes and layouts
- Feature components and `use<Feature>.ts` hooks (TanStack Query)
- Zustand stores for client state
- shadcn/ui + Tailwind for all UI — no raw HTML elements when a primitive exists
- Vitest unit tests and Playwright E2E tests

Key constraints: TypeScript strict (no `any` without comment); all API calls through `src/lib/api-client.ts`; env vars only through the typed wrapper; accessible markup with `aria-label` on ambiguous controls.

---

### Example usage

```
# Describe a feature to the product manager and let it coordinate:
"Add a monthly budget tracker — users can set a budget per category and see spending vs budget."

# The product-manager agent will:
# 1. Audit existing models and routes
# 2. Define backend tasks (Budget model, migration, CRUD endpoints)
# 3. Define frontend tasks (budget route, BudgetCard component, useBudget hook)
# 4. Delegate to api-backend (backend), then web-frontend (frontend)
# 5. Confirm both tracks meet acceptance criteria
```

## Database (Cloud)

For cloud deployment, use **[Neon](https://neon.tech)** (free tier: 10 GB, no idle pausing, database branching). Set `DATABASE_URL` in your deployment environment to the Neon connection string.
