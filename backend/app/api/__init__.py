from app.api.auth import router as auth_router
from app.api.calendar import router as calendar_router
from app.api.files import router as files_router

__all__ = [
    "auth_router",
    "calendar_router",
    "files_router",
]