from fastapi import FastAPI

from app.core.config import settings

# Cria todas as tabelas definidas nos modelos

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)


@app.get("/")
def root():
    return {
        "message": "EPIC Payments API está a funcionar"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }