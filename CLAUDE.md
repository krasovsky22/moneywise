# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This monorepo is being scaffolded from `INITIAL_PROMPT.md`. No business logic exists yet — only the foundation wiring.

## Commands

### Root (requires pnpm workspaces + Turborepo)
```bash
pnpm install          # Install all JS/TS dependencies
pnpm dev              # Start API (:8000) + web (:3000) concurrently
pnpm build            # Production build for both apps
pnpm test             # Run all tests (Vitest + pytest via Turborepo)
pnpm lint             # Lint entire workspace
pnpm typecheck        # TypeScript strict check + mypy
```

### Backend (`apps/api`)
```bash
uv sync                                    # Install Python dependencies
uv run uvicorn app.main:app --reload       # Dev server
uv run pytest                              # All tests
uv run pytest tests/test_health.py        # Single test file
uv run ruff check .                        # Lint
uv run ruff format .                       # Format
uv run mypy src/                           # Type check
uv run alembic upgrade head                # Apply migrations
uv run alembic revision --autogenerate -m "description"  # New migration
```

### Frontend (`apps/web`)
```bash
pnpm --filter web dev          # Dev server only
pnpm --filter web test         # Vitest unit tests
pnpm --filter web test:e2e     # Playwright E2E tests
pnpm --filter web typecheck    # tsc --noEmit
```

### Infrastructure
```bash
docker compose up -d     # Start Postgres + Redis
docker compose down      # Stop services
```

## Architecture

### Monorepo structure
```
moneywise/
├── apps/
│   ├── api/     # Python FastAPI backend
│   └── web/     # React 19 + Vite + TypeScript frontend
├── packages/
│   └── shared-types/    # Shared TS types (workspace:* protocol)
├── turbo.json            # Orchestrates tasks across apps
└── pnpm-workspace.yaml
```

Turborepo orchestrates JS/TS tasks natively; the Python `apps/api` is wired via `uv run` scripts so root `pnpm` commands span both.

### Backend (`apps/api`)

Domain-driven layout under `src/app/`:
- `core/` — settings (Pydantic Settings), database session, security (JWT), structured logging
- `api/v1/` — versioned route registration; each endpoint file is thin (delegates to services)
- `modules/<feature>/` — each feature owns `router.py`, `schemas.py`, `models.py`, `service.py`, `dependencies.py`
- `common/` — shared exceptions, base models, utilities

Key patterns:
- **Async-first**: all routes, SQLAlchemy sessions, and DB queries are async
- **Pydantic Settings** loads env vars — never access `os.environ` directly in app code
- **FastAPI is OpenAPI-first**: the auto-generated spec at `/docs` is the source of truth; a typed TS client will later be generated from it (TODO in `lib/api-client.ts`)
- CORS middleware is configured to allow the React dev server origin

### Frontend (`apps/web`)

Feature-based layout under `src/`:
- `routes/` — TanStack Router file-based routes (`__root.tsx`, `index.tsx`, etc.)
- `features/<name>/` — co-located components, hooks, and API calls per feature
- `components/ui/` — shadcn/ui primitives only (no business logic)
- `lib/api-client.ts` — configured Axios/ky instance (proxy target: `/api` → `http://localhost:8000`)
- `lib/query-client.ts` — TanStack Query setup
- `stores/` — Zustand stores for client state

Key patterns:
- Vite dev proxy forwards `/api` → `http://localhost:8000` (no CORS in dev)
- `import.meta.env` accessed only through a typed wrapper — never raw in app code
- TypeScript strict mode; no `any` without a justifying comment
- MSW used for API mocking in tests and optionally in dev

### Data flow (request lifecycle)
```
Browser → TanStack Query (cache) → api-client.ts (Axios/ky) → Vite proxy
→ FastAPI route → service → async SQLAlchemy session → PostgreSQL
```

## Conventions

- **Python 3.12+**, fully type-annotated, `mypy --strict` clean
- **TypeScript strict mode** on across the entire frontend
- All secrets in `.env` (gitignored); `.env.example` checked in with placeholder values
- Internal packages referenced with `workspace:*` protocol
- Pre-commit hooks (lefthook or husky + lint-staged) run `ruff` on Python and ESLint/Prettier on TS/TSX
