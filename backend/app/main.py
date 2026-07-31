from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth_router, calendar_router, files_router
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(calendar_router)
app.include_router(files_router)


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