# MoneyWise

Personal finance management app — monorepo scaffold.

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

- **Frontend:** http://localhost:3000 — shows API health status
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
| `make reset-data EMAIL=...`   | Delete all statements & transactions for a user's household |

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

## Technical Docs

- [Statement upload & parsing pipeline](docs/technical/statement-processing.md) — how files go from upload to categorized transactions, with flow diagrams and code links

## AI Parsing Configuration

Statement files are parsed by an AI pipeline (Epic 04) that extracts transactions, normalizes merchant names, and assigns categories.

**Provider:** OpenAI Chat Completions API  
**Default model:** `gpt-5-mini` (fast, cheap, accurate for structured extraction)

To enable AI parsing, set `OPENAI_API_KEY` in `apps/api/.env`:

```bash
OPENAI_API_KEY=sk-proj-...
```

Without a key the pipeline still runs — it parses pages and classifies them, but writes zero transactions (mock mode). This lets the app function end-to-end for development without incurring API costs.

**Configurable env vars (all in `apps/api/.env`):**

| Variable               | Default      | Description                                                |
| ---------------------- | ------------ | ---------------------------------------------------------- |
| `OPENAI_API_KEY`       | _(empty)_    | OpenAI API key — leave blank for mock mode                 |
| `AI_MODEL`             | `gpt-5-mini` | Any OpenAI chat completion model ID                        |
| `CONFIDENCE_THRESHOLD` | `0.7`        | Rows below this score flag the statement as `needs_review` |

**Cost:** `gpt-4o-mini` runs at $0.15 / 1M input tokens + $0.60 / 1M output tokens. A typical 20-page credit card statement (≈100 transactions) costs well under $0.01 per parse. Exact cost is recorded in `Statement.ai_cost_cents` and visible via `GET /api/v1/statements/{id}`.

**Switching models:** set `AI_MODEL` to any OpenAI model that supports `response_format: json_object` (e.g., `gpt-4o`, `gpt-4-turbo`). The pipeline uses JSON mode so structured output is guaranteed without prompt-engineering workarounds.

## Background / Worker Commands

FastAPI processes short background tasks (e.g. statement parsing) in-process via `BackgroundTasks`. No separate worker process is needed for MVP.

When a real job queue is introduced (Epic 04+), the worker will be started alongside the API:

```bash
# Placeholder — not yet wired
cd apps/api
uv run arq app.worker.WorkerSettings   # or: uv run rq worker
```

Until then, all background processing runs automatically when the API server is up.

## Management CLI

The API ships a management CLI for administrative tasks that shouldn't go through the HTTP API.

```bash
# Set / reset a password — prompts securely, nothing in shell history (recommended)
make set-password EMAIL=user@example.com

# Pass password directly (useful in CI/scripts)
make set-password EMAIL=user@example.com PASSWORD=newpassword

# Delete all statements and transactions for a user's household (prompts for confirmation)
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
