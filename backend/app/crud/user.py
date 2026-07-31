from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User
from app.schemas import UserCreate


def get_user_by_username(
    db: Session,
    username: str,
) -> User | None:
    return (
        db.query(User)
        .filter(User.username == username)
        .first()
    )


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    return (
        db.query(User)
        .filter(User.email == email)
        .first()
    )


def create_user(
    db: Session,
    user: UserCreate,
    role: str = "user",
) -> User:
    db_user = User(
        name=user.name,
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password),
        role=role,
        is_active=True,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user