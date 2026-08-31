from app.api.auth import router as auth_router
from app.api.calendar import router as calendar_router
from app.api.files import router as files_router
from app.api.cedis import router as cedis_router
from app.api.users import router as users_router
from app.api.communication import router as communication_router


__all__ = [
    "auth_router",
    "calendar_router",
    "files_router",
    "cedis_router",
    "users_router",
    "communication_router",
]