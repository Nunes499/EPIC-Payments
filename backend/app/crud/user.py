from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import User
from app.schemas.user import UserCreate, UserUpdate


def get_user_by_id(
    db: Session,
    user_id: int,
) -> User | None:
    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )


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


def list_users(
    db: Session,
) -> list[User]:
    return (
        db.query(User)
        .order_by(User.name.asc())
        .all()
    )


def create_user(
    db: Session,
    user: UserCreate,
) -> User:
    db_user = User(
        name=user.name.strip(),
        username=user.username.strip(),
        email=str(user.email).strip().lower(),
        password_hash=hash_password(user.password),
        role=user.role,
        is_active=True,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


def update_user(
    db: Session,
    db_user: User,
    data: UserUpdate,
) -> User:
    values = data.model_dump(
        exclude_unset=True,
    )

    if "name" in values and values["name"] is not None:
        values["name"] = values["name"].strip()

    if "username" in values and values["username"] is not None:
        values["username"] = values["username"].strip()

    if "email" in values and values["email"] is not None:
        values["email"] = str(
            values["email"]
        ).strip().lower()

    for field, value in values.items():
        setattr(
            db_user,
            field,
            value,
        )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


def set_user_password(
    db: Session,
    db_user: User,
    new_password: str,
) -> User:
    db_user.password_hash = hash_password(
        new_password
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


def set_user_photo_key(
    db: Session,
    db_user: User,
    object_key: str | None,
) -> User:
    db_user.photo_object_key = object_key

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user