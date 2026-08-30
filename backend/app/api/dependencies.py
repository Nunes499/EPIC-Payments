from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.crud.user import get_user_by_id
from app.database.session import get_db
from app.models import User


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada.",
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )

    payload = decode_access_token(
        token
    )

    if payload is None:
        raise credentials_error

    subject = payload.get(
        "sub"
    )

    if subject is None:
        raise credentials_error

    try:
        user_id = int(
            subject
        )
    except (
        TypeError,
        ValueError,
    ):
        raise credentials_error

    user = get_user_by_id(
        db,
        user_id,
    )

    if (
        user is None
        or not user.is_active
    ):
        raise credentials_error

    return user


def require_admin(
    current_user: User = Depends(
        get_current_user
    ),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Apenas administradores podem "
                "aceder a esta área."
            ),
        )

    return current_user