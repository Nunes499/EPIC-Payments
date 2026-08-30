from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import create_access_token, verify_password
from app.crud.user import set_user_password
from app.database.session import get_db
from app.models import User
from app.schemas import Token
from app.schemas.user import (
    MessageResponse,
    PasswordChange,
    UserRead,
)
from app.services import authenticate_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def to_user_read(
    user: User,
) -> UserRead:
    return UserRead(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        has_photo=bool(
            user.photo_object_key
        ),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post(
    "/login",
    response_model=Token,
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    user = authenticate_user(
        db=db,
        username=form_data.username,
        password=form_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username ou password incorretos.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    access_token = create_access_token(
        subject=str(
            user.id
        ),
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=UserRead,
)
def me(
    current_user: User = Depends(
        get_current_user
    ),
) -> UserRead:
    return to_user_read(
        current_user
    )


@router.put(
    "/me/password",
    response_model=MessageResponse,
)
def change_my_password(
    data: PasswordChange,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
) -> MessageResponse:
    if not verify_password(
        data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A password atual "
                "está incorreta."
            ),
        )

    if verify_password(
        data.new_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A nova password tem "
                "de ser diferente da atual."
            ),
        )

    set_user_password(
        db,
        current_user,
        data.new_password,
    )

    return MessageResponse(
        message=(
            "Password alterada "
            "com sucesso."
        ),
    )