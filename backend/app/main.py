from fastapi import FastAPI

from app.core.config import settings
from app.database.session import Base, engine
from app.models import User

# Cria todas as tabelas definidas nos modelos
Base.metadata.create_all(bind=engine)

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