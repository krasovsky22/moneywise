# Initial Project Setup Prompt — Python API + React Monorepo

## Objective

Bootstrap a new **monorepo** containing a Python API backend and a React client application. Set up the full project skeleton with all configuration files, tooling, linting, testing scaffolds, and a working "hello world" round-trip between client and API. No business logic yet — just the foundation.

---

## High-Level Architecture

```
my-app/                          # Monorepo root
├── apps/
│   ├── api/                     # Python FastAPI backend
│   └── web/                     # React + Vite + TypeScript frontend
├── packages/
│   └── shared-types/            # (Optional) Shared TS types / OpenAPI-generated client
├── .github/workflows/           # CI pipelines
├── docker-compose.yml           # Local dev: API + Postgres + Redis
├── pnpm-workspace.yaml          # pnpm workspaces config
├── turbo.json                   # Turborepo pipeline
├── package.json                 # Root workspace
├── .gitignore
├── .editorconfig
└── README.md
```

---

## Recommended Stack

### Monorepo Tooling

| Tool | Purpose | Why |
|------|---------|-----|
| **pnpm workspaces** | Package manager + workspace linking | Faster than npm/yarn, efficient disk usage via symlinks, the de-facto standard for JS monorepos in 2026 |
| **Turborepo** | Task orchestration + caching | Minimal config, excellent caching, Vercel-backed, ideal for small-to-medium monorepos |
| **uv** | Python package & project manager | Rust-based, extremely fast, replaces pip/poetry/pyenv, has become the standard for new Python projects |

> **Note:** Turborepo orchestrates JS/TS tasks natively. For the Python `apps/api` directory, we wire `turbo` to call `uv run` scripts so a single `pnpm dev` / `pnpm build` / `pnpm test` works across the whole repo.

### Backend (`apps/api`)

| Library | Purpose |
|---------|---------|
| **FastAPI** | Async-first web framework, type-safe, auto-generated OpenAPI docs |
| **Pydantic v2** | Request/response validation and settings (`pydantic-settings`) |
| **SQLAlchemy 2.0 (async)** | ORM with async support |
| **asyncpg** | Async PostgreSQL driver |
| **Alembic** | Database migrations |
| **Uvicorn** (dev) / **Gunicorn + UvicornWorker** (prod) | ASGI server |
| **python-jose** + **passlib[bcrypt]** | JWT auth + password hashing |
| **httpx** | Async HTTP client (also for tests) |
| **structlog** | Structured logging |
| **pytest** + **pytest-asyncio** + **pytest-cov** | Testing |
| **ruff** | Linter + formatter (replaces black, isort, flake8) |
| **mypy** | Static type checking |
| **uv** | Dependency management via `pyproject.toml` |

### Frontend (`apps/web`)

| Library | Purpose |
|---------|---------|
| **React 19** + **TypeScript** | UI library + type safety |
| **Vite** | Build tool + dev server (Create React App is deprecated) |
| **TanStack Router** | Type-safe routing (preferred over react-router for new SPAs) |
| **TanStack Query** | Server state / data fetching / caching |
| **Zustand** | Client-side state management (minimal boilerplate vs Redux) |
| **React Hook Form** + **Zod** | Forms + schema validation |
| **Tailwind CSS** + **shadcn/ui** | Styling + accessible component primitives |
| **Axios** or **ky** | HTTP client (or generate one from the API's OpenAPI spec) |
| **Vitest** + **React Testing Library** | Unit/component testing |
| **Playwright** | E2E testing |
| **ESLint** + **Prettier** (or **Biome**) | Lint + format |
| **MSW** (Mock Service Worker) | API mocking in tests & dev |

### Database & Infrastructure

- **PostgreSQL 16+** — primary datastore
- **Redis** — caching / rate limiting / background job queue
- **Docker Compose** — local development orchestration
- **GitHub Actions** — CI/CD

---

## What to Generate

Please scaffold the entire monorepo with the following deliverables:

### 1. Root configuration
- `package.json` with pnpm workspace scripts (`dev`, `build`, `test`, `lint`, `typecheck`)
- `pnpm-workspace.yaml`
- `turbo.json` with task pipeline (build, test, lint, dev) and proper `dependsOn` graph
- `.gitignore` covering Python, Node, IDE, OS, and env files
- `.editorconfig`
- `.nvmrc` / `.node-version` pinning Node LTS
- Root `README.md` with quickstart, architecture overview, and common commands

### 2. Backend (`apps/api`)
- `pyproject.toml` configured for **uv** with all dependencies above
- Project structure following the **domain-driven** layout (inspired by Netflix Dispatch / zhanymkanov's best-practices repo):
  ```
  apps/api/
  ├── src/app/
  │   ├── main.py              # FastAPI app factory, middleware, router registration
  │   ├── core/                # Settings, security, logging, db session
  │   │   ├── config.py
  │   │   ├── database.py
  │   │   ├── security.py
  │   │   └── logging.py
  │   ├── api/
  │   │   └── v1/              # Versioned API routes
  │   │       ├── router.py
  │   │       └── health.py    # Sample /health endpoint
  │   ├── modules/             # Feature modules (each with router/schemas/models/service)
  │   │   └── users/           # Example skeleton module
  │   │       ├── router.py
  │   │       ├── schemas.py
  │   │       ├── models.py
  │   │       ├── service.py
  │   │       └── dependencies.py
  │   └── common/              # Shared utilities, exceptions, base models
  ├── tests/
  │   ├── conftest.py          # Async test client, db fixtures
  │   └── test_health.py
  ├── alembic/
  │   ├── env.py
  │   └── versions/
  ├── alembic.ini
  ├── Dockerfile               # Multi-stage build using uv
  ├── .env.example
  └── pyproject.toml
  ```
- A working `/health` endpoint returning `{"status": "ok"}`
- Pydantic `Settings` class loading from `.env`
- Async SQLAlchemy session dependency
- Alembic configured for autogenerate with async engine
- CORS middleware configured for the React dev server origin
- One sample passing test

### 3. Frontend (`apps/web`)
- Scaffolded with `pnpm create vite@latest web -- --template react-ts`
- Project structure (feature-based, inspired by Bulletproof React):
  ```
  apps/web/
  ├── src/
  │   ├── main.tsx
  │   ├── app.tsx              # Router + providers
  │   ├── routes/              # TanStack Router file-based routes
  │   │   ├── __root.tsx
  │   │   └── index.tsx
  │   ├── features/            # Feature modules (each with components/hooks/api)
  │   ├── components/ui/       # shadcn/ui components
  │   ├── lib/
  │   │   ├── api-client.ts    # Configured Axios/ky instance
  │   │   └── query-client.ts  # TanStack Query setup
  │   ├── stores/              # Zustand stores
  │   ├── hooks/
  │   ├── types/
  │   └── styles/
  │       └── globals.css      # Tailwind directives
  ├── tests/
  │   └── setup.ts             # Vitest + RTL setup
  ├── public/
  ├── index.html
  ├── vite.config.ts           # With path aliases, proxy to API in dev
  ├── tsconfig.json            # Strict mode on
  ├── tailwind.config.ts
  ├── postcss.config.js
  ├── components.json          # shadcn/ui config
  ├── eslint.config.js         # Flat config
  ├── .env.example
  ├── Dockerfile               # Multi-stage with nginx for prod
  └── package.json
  ```
- A landing page that calls the API's `/health` endpoint via TanStack Query and displays the result — proves end-to-end wiring
- Vite dev proxy forwarding `/api` to `http://localhost:8000`
- Tailwind + shadcn/ui initialized with at least a `Button` component installed as a demo
- One passing component test

### 4. Local development
- `docker-compose.yml` defining services for: `postgres`, `redis`, and optionally `api` and `web` (with hot reload)
- `.env.example` files in repo root and both apps
- A `Makefile` **or** root npm scripts for: `make up`, `make down`, `make migrate`, `make seed`, `make logs`

### 5. CI/CD (`.github/workflows/`)
- `ci.yml` running on PR: install → lint → typecheck → test → build, with Turborepo remote cache (or local cache) and matrix for `apps/api` (Python) and `apps/web` (Node)
- Cache `uv` and `pnpm` stores for speed
- Run Alembic migration check (no pending model changes without a migration)

### 6. Developer experience
- Pre-commit hooks via **lefthook** or **husky + lint-staged**: run `ruff` on Python, `eslint`/`prettier` on TS/TSX, block commits to `main`
- VS Code workspace settings + recommended extensions (`.vscode/settings.json`, `.vscode/extensions.json`)
- Conventional commit message template

---

## Conventions & Constraints

- **TypeScript strict mode** on, no `any` unless justified with a comment
- **Python 3.12+**, fully type-annotated, `mypy --strict` clean
- **No business logic** in this initial scaffold — only the wiring needed to prove the stack works
- **Environment variables** loaded via Pydantic Settings (backend) and Vite's `import.meta.env` with a typed wrapper (frontend) — never `process.env` directly in app code
- **OpenAPI-first**: the FastAPI spec is the source of truth; later we'll generate a typed TS client from it (e.g., via `openapi-typescript` or `orval`) — leave a TODO comment for this
- All secrets in `.env` (gitignored); `.env.example` checked in with placeholder values
- Use **workspace protocol** (`workspace:*`) for any future shared internal packages

---

## Deliverables Checklist

Before declaring done, verify:

- [ ] `pnpm install` at the root installs everything
- [ ] `uv sync` inside `apps/api` installs Python deps
- [ ] `docker compose up -d` starts Postgres + Redis
- [ ] `pnpm dev` starts both the API (`:8000`) and the web app (`:5173`) concurrently
- [ ] Visiting `http://localhost:5173` shows a page that successfully reads `/health` from the API
- [ ] `pnpm test` runs both frontends and backend tests, all passing
- [ ] `pnpm lint` and `pnpm typecheck` pass with zero errors
- [ ] `pnpm build` produces production artifacts for both apps
- [ ] OpenAPI docs are reachable at `http://localhost:8000/docs`
- [ ] README explains how to set up from scratch in under 5 minutes

---

## Out of Scope (For Later)

- Authentication flow implementation (only scaffolding included now)
- Production deployment manifests (Kubernetes, Terraform)
- Observability stack (OpenTelemetry, Sentry, Grafana)
- Background workers / Celery / arq
- Email service integration
- Feature flags
- Generated TypeScript client from OpenAPI

---

## Output Format

Generate the full file tree with the contents of every file. Group files logically, explain any non-obvious decisions briefly inline as code comments, and finish with a short "How to run" section the developer can follow without any extra context.
