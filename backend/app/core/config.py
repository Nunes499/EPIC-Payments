from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EPIC Payments API"
    app_version: str = "0.1.0"
    database_url: str = (
        "postgresql+psycopg://epic_user:epic_password@db:5432/epic_payments"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()