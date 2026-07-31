from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.crud import get_user_by_username
from app.models import User


def authenticate_user(
    db: Session,
    username: str,
    password: str,
) -> User | None:
    user = get_user_by_username(db, username)

    if user is None:
        return None

    if not user.is_active:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user