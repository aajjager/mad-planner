from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: SecretStr = SecretStr(
        "postgresql+psycopg://madplanner:madplanner@localhost:5432/madplanner"
    )
    session_cookie_name: str = "madplanner_session"
    session_cookie_secure: bool = False
    media_root: Path = Path("/data/media")
    mfa_encryption_key: SecretStr | None = None
    implementation_worker_token: SecretStr | None = None
    implementation_preview_url: str | None = None
    push_enabled: bool = False
    push_vapid_private_key: SecretStr | None = None
    push_vapid_public_key: str | None = None
    push_vapid_subject: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
