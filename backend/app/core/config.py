from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    app_name: str = (
        "EPIC Payments API"
    )

    app_version: str = "0.1.0"

    database_url: str = (
        "postgresql+psycopg://"
        "epic_user:epic_password"
        "@db:5432/epic_payments"
    )

    secret_key: str = (
        "alterar-esta-chave-em-producao"
    )

    algorithm: str = "HS256"

    access_token_expire_minutes: int = 60

    # =====================================================
    # NEON POSTGRESQL
    # =====================================================

    # Limite de armazenamento de referência do projeto.
    #
    # O plano Free da Neon inclui atualmente
    # 0,5 GB de armazenamento por projeto.
    #
    # Este valor pode ser substituído através de:
    # NEON_STORAGE_LIMIT_BYTES
    #
    # 512 MiB = 536870912 bytes.
    neon_storage_limit_bytes: int = 536870912

    # =====================================================
    # CLOUDFLARE R2
    # =====================================================

    r2_bucket_name: str = ""
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""

    # =====================================================
    # CLOUDFLARE
    # =====================================================

    cloudflare_account_id: str = ""
    cloudflare_d1_database_id: str = ""
    cloudflare_d1_api_token: str = ""
    cloudflare_monitoring_api_token: str = ""

    # =====================================================
    # EASYPAY
    # =====================================================

    easypay_account_id: str = ""
    easypay_api_key: str = ""

    easypay_api_url: str = (
        "https://api.prod.easypay.pt/2.0"
    )

    # Credenciais exclusivas para autenticação
    # HTTP Basic das notificações/webhooks Easypay.
    #
    # São independentes da API Key da Easypay.
    # Nunca devem ser colocadas no frontend.
    easypay_webhook_username: str = ""
    easypay_webhook_password: str = ""

    # =====================================================
    # SMSUP
    # =====================================================

    smsup_api_key: str = ""

    smsup_api_url: str = (
        "https://api.gateway360.com/"
        "api/3.0/sms/send"
    )

    smsup_sender: str = "EpicFitness"

    # =====================================================
    # PYDANTIC SETTINGS
    # =====================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()