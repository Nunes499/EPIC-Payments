from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EPIC Payments API"
    app_version: str = "0.1.0"

    database_url: str = (
        "postgresql+psycopg://epic_user:epic_password@db:5432/epic_payments"
    )

    secret_key: str = "alterar-esta-chave-em-producao"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    easypay_account_id: str = ""
    easypay_api_key: str = ""
    easypay_api_url: str = "https://api.prod.easypay.pt/2.0"

    smsup_api_key: str = ""
    smsup_api_url: str = "https://api.gateway360.com/api/3.0/sms/send"
    smsup_sender: str = "EpicFitness"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
