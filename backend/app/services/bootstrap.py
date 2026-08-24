from sqlalchemy.orm import Session

from app.models import User


def create_initial_admin(db: Session) -> None:
    """Verifica se já existe um administrador."""

    admin = (
        db.query(User)
        .filter(User.role == "admin")
        .first()
    )

    if admin:
        print(
            f"✓ Administrador existente: {admin.username}"
        )
        return

    print(
        "⚠ Nenhum administrador encontrado. "
        "Crie um administrador manualmente."
    )