from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth_router,
    calendar_router,
    cedis_router,
    files_router,
    users_router,
)
from app.core.config import settings
from app.database.session import SessionLocal
from app.services import create_initial_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()

    try:
        create_initial_admin(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)


default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

extra_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "",
    ).split(",")
    if origin.strip()
]

allowed_origins = list(
    dict.fromkeys(
        default_origins
        + extra_origins
    )
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(calendar_router)
app.include_router(files_router)
app.include_router(cedis_router)
app.include_router(users_router)


@app.get("/")
def root():
    return {
        "message": "EPIC Payments API está a funcionar",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }