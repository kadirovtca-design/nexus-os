from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / .env.

    Nothing secret has a usable default: DATABASE_URL must point at a real
    database and the Anthropic key is optional (the assistant degrades
    gracefully when it is missing).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NEXUS OS"
    environment: str = Field(default="development", pattern="^(development|test|production)$")

    database_url: str = "postgresql+psycopg://nexus:nexus@localhost:5432/nexus"

    # Sessions
    session_cookie_name: str = "nexus_session"
    session_ttl_days: int = 30
    cookie_secure: bool = False  # set true behind HTTPS

    cors_origins: list[str] = ["http://localhost:3000"]

    # Login throttling (per process)
    login_max_attempts: int = 8
    login_window_seconds: int = 300

    # AI assistant
    anthropic_api_key: str | None = None
    ai_model: str = "claude-opus-5-5"
    ai_effort: str = Field(default="low", pattern="^(low|medium|high|xhigh|max)$")
    ai_max_tokens: int = 8000
    ai_refusal_fallback: bool = True

    @field_validator("database_url")
    @classmethod
    def _driver(cls, v: str) -> str:
        # Hosting providers (Render, Heroku, Neon…) hand out postgres:// URLs; we use psycopg 3.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
