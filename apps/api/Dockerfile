# Multi-stage build using official uv Docker pattern
# See: https://docs.astral.sh/uv/guides/integration/docker/

FROM python:3.12-slim AS base

# Install uv from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install production deps only (--frozen = use exact locked versions)
RUN uv sync --frozen --no-dev

# Copy application source
COPY src/ ./src/

# ---- Production stage ----
FROM base AS production

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
