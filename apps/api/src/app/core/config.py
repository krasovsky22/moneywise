from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/moneywise"
    )

    # Security — no default so startup fails fast if missing in prod
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — Pydantic Settings v2 parses JSON strings for list fields
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # App metadata
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"


settings = Settings()
