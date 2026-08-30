from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin
from app.core.security import hash_password
from app.crud.user import (
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    list_users,
    set_user_password,
    set_user_photo_key,
    update_user,
)
from app.database.session import get_db
from app.models import User
from app.schemas.user import (
    AdminPasswordReset,
    MessageResponse,
    UserRead,
    UserUpdate,
)
from app.services.storage_service import (
    delete_object,
    download_object,
    upload_object,
)


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_PHOTO_SIZE = 5 * 1024 * 1024


def to_user_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        has_photo=bool(user.photo_object_key),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def get_user_or_404(
    db: Session,
    user_id: int,
) -> User:
    user = get_user_by_id(db, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilizador não encontrado.",
        )

    return user


async def validate_photo(
    photo: UploadFile,
) -> tuple[bytes, str]:
    content_type = photo.content_type or ""

    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A fotografia deve estar em "
                "formato JPG, PNG ou WEBP."
            ),
        )

    content = await photo.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A fotografia está vazia.",
        )

    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A fotografia não pode exceder 5 MB."
            ),
        )

    return content, ALLOWED_IMAGE_TYPES[content_type]


def ensure_unique_username(
    db: Session,
    username: str,
    ignore_user_id: int | None = None,
) -> None:
    existing = get_user_by_username(
        db,
        username.strip(),
    )

    if (
        existing is not None
        and existing.id != ignore_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este username já está em utilização.",
        )


def ensure_unique_email(
    db: Session,
    email: str,
    ignore_user_id: int | None = None,
) -> None:
    existing = get_user_by_email(
        db,
        email.strip().lower(),
    )

    if (
        existing is not None
        and existing.id != ignore_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este email já está em utilização.",
        )


@router.get(
    "",
    response_model=list[UserRead],
)
def get_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UserRead]:
    users = list_users(db)

    return [
        to_user_read(user)
        for user in users
    ]


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_user(
    name: str = Form(...),
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("collaborator"),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    clean_name = name.strip()
    clean_username = username.strip()
    clean_email = email.strip().lower()

    if len(clean_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O nome deve ter pelo menos 2 caracteres.",
        )

    if len(clean_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "O username deve ter pelo menos "
                "3 caracteres."
            ),
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A password deve ter pelo menos "
                "8 caracteres."
            ),
        )

    if role not in {"admin", "collaborator"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de utilizador inválido.",
        )

    ensure_unique_username(
        db,
        clean_username,
    )
    ensure_unique_email(
        db,
        clean_email,
    )

    photo_content, extension = await validate_photo(
        photo
    )

    user = User(
        name=clean_name,
        username=clean_username,
        email=clean_email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    object_key = (
        f"users/{user.id}/"
        f"profile-{uuid4().hex}.{extension}"
    )

    try:
        upload_object(
            object_key,
            photo_content,
            photo.content_type or "image/jpeg",
        )
    except Exception:
        db.delete(user)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Não foi possível guardar a fotografia "
                "do utilizador."
            ),
        )

    set_user_photo_key(
        db,
        user,
        object_key,
    )

    return to_user_read(user)


@router.get(
    "/me/photo",
)
def get_my_photo(
    current_user: User = Depends(get_current_user),
) -> Response:
    if not current_user.photo_object_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este utilizador não tem fotografia.",
        )

    content, content_type = download_object(
        current_user.photo_object_key
    )

    return Response(
        content=content,
        media_type=content_type,
    )


@router.put(
    "/me/photo",
    response_model=UserRead,
)
async def update_my_photo(
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    content, extension = await validate_photo(photo)

    new_key = (
        f"users/{current_user.id}/"
        f"profile-{uuid4().hex}.{extension}"
    )

    upload_object(
        new_key,
        content,
        photo.content_type or "image/jpeg",
    )

    old_key = current_user.photo_object_key

    set_user_photo_key(
        db,
        current_user,
        new_key,
    )

    if old_key:
        try:
            delete_object(old_key)
        except Exception:
            pass

    return to_user_read(current_user)


@router.get(
    "/{user_id}",
    response_model=UserRead,
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = get_user_or_404(
        db,
        user_id,
    )

    return to_user_read(user)


@router.get(
    "/{user_id}/photo",
)
def get_user_photo(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    user = get_user_or_404(
        db,
        user_id,
    )

    if not user.photo_object_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este utilizador não tem fotografia.",
        )

    content, content_type = download_object(
        user.photo_object_key
    )

    return Response(
        content=content,
        media_type=content_type,
    )


@router.put(
    "/{user_id}",
    response_model=UserRead,
)
def edit_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> UserRead:
    user = get_user_or_404(
        db,
        user_id,
    )

    if data.username is not None:
        ensure_unique_username(
            db,
            data.username,
            user.id,
        )

    if data.email is not None:
        ensure_unique_email(
            db,
            str(data.email),
            user.id,
        )

    if (
        current_admin.id == user.id
        and data.is_active is False
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Não pode desativar a sua "
                "própria conta."
            ),
        )

    if (
        current_admin.id == user.id
        and data.role is not None
        and data.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Não pode remover o seu próprio "
                "perfil de Administrador."
            ),
        )

    user = update_user(
        db,
        user,
        data,
    )

    return to_user_read(user)


@router.put(
    "/{user_id}/password",
    response_model=MessageResponse,
)
def reset_user_password(
    user_id: int,
    data: AdminPasswordReset,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageResponse:
    user = get_user_or_404(
        db,
        user_id,
    )

    set_user_password(
        db,
        user,
        data.new_password,
    )

    return MessageResponse(
        message="Password alterada com sucesso.",
    )


@router.put(
    "/{user_id}/photo",
    response_model=UserRead,
)
async def update_user_photo(
    user_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRead:
    user = get_user_or_404(
        db,
        user_id,
    )

    content, extension = await validate_photo(photo)

    new_key = (
        f"users/{user.id}/"
        f"profile-{uuid4().hex}.{extension}"
    )

    upload_object(
        new_key,
        content,
        photo.content_type or "image/jpeg",
    )

    old_key = user.photo_object_key

    set_user_photo_key(
        db,
        user,
        new_key,
    )

    if old_key:
        try:
            delete_object(old_key)
        except Exception:
            pass

    return to_user_read(user)