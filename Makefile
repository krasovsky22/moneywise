.PHONY: up down migrate seed logs install dev clean

# Start infrastructure (postgres + redis)
up:
	docker compose up -d

# Stop infrastructure
down:
	docker compose down

# Apply all pending Alembic migrations
migrate:
	cd apps/api && uv run alembic upgrade head

# Create a new migration (usage: make migration MSG="add users table")
migration:
	cd apps/api && uv run alembic revision --autogenerate -m "$(MSG)"

# Placeholder for seed data
seed:
	@echo "No seed data yet"

# Tail infrastructure logs
logs:
	docker compose logs -f

# Install all dependencies (JS + Python)
install:
	pnpm install
	cd apps/api && uv sync

# Start infrastructure then both dev servers
dev: up
	pnpm dev

# Remove all build artifacts and caches
clean:
	rm -rf apps/web/dist apps/api/dist .turbo node_modules apps/web/node_modules
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
