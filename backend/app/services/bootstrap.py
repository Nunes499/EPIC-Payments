from sqlalchemy.orm import Session

from app.crud import create_user, get_user_by_username
from app.schemas import UserCreate


def create_initial_admin(db: Session) -> None:
    """Cria o utilizador administrador caso ainda não exista."""

    if get_user_by_username(db, "admin"):
        return

    admin = UserCreate(
        name="Administrator",
        username="admin",
        email="nunesnunes49@gmail.com",
        password="admin123",
    )

    create_user(
        db=db,
        user=admin,
        role="admin",
    )

    print("✓ Utilizador administrador criado.")