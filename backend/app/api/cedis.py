from io import BytesIO
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import (
    FileResponse,
    StreamingResponse,
)
from sqlalchemy.orm import Session

from app.crud.cedis_file import (
    get_active_cedis_file,
    get_cedis_history,
)
from app.database.session import get_db
from app.schemas.cedis_file import (
    CedisFileRead,
    CedisPreviewResponse,
)
from app.services.cedis_service import (
    build_cedis_preview,
    get_cedis_file_contents,
    get_existing_cedis_file,
    get_existing_cedis_file_path,
    is_r2_file_path,
    restore_cedis_file,
    save_cedis_file,
)


router = APIRouter(
    prefix="/cedis",
    tags=["CEDIS"],
)


@router.get(
    "/active",
    response_model=CedisFileRead | None,
)
def get_active_base(
    db: Session = Depends(get_db),
):
    return get_active_cedis_file(db)


@router.get(
    "/history",
    response_model=list[CedisFileRead],
)
def list_cedis_history(
    db: Session = Depends(get_db),
):
    return get_cedis_history(db)


@router.post(
    "/upload",
    response_model=CedisFileRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_cedis_base(
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await save_cedis_file(
        db,
        upload=upload,
        uploaded_by_id=None,
    )


@router.post(
    "/{file_id}/restore",
    response_model=CedisFileRead,
    status_code=status.HTTP_201_CREATED,
)
def restore_cedis_base(
    file_id: int,
    db: Session = Depends(get_db),
):
    return restore_cedis_file(
        db,
        file_id=file_id,
        uploaded_by_id=None,
    )


@router.get(
    "/{file_id}/preview",
    response_model=CedisPreviewResponse,
)
def preview_cedis_base(
    file_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if limit < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O limite deve ser superior a zero.",
        )

    cedis_file = get_existing_cedis_file(
        db,
        file_id=file_id,
    )

    return build_cedis_preview(
        cedis_file,
        limit=limit,
    )


@router.get(
    "/{file_id}/download",
)
def download_cedis_base(
    file_id: int,
    db: Session = Depends(get_db),
):
    cedis_file = get_existing_cedis_file(
        db,
        file_id=file_id,
    )

    media_type = (
        cedis_file.mime_type
        or "application/vnd.ms-excel"
    )

    filename = (
        cedis_file.original_filename
        or f"cedis_{cedis_file.id}.xls"
    )

    if is_r2_file_path(
        cedis_file.file_path
    ):
        try:
            contents = get_cedis_file_contents(
                cedis_file
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Não foi possível obter "
                    "a Base CEDIS do Cloudflare R2."
                ),
            ) from exc

        encoded_filename = quote(
            filename
        )

        return StreamingResponse(
            BytesIO(contents),
            media_type=media_type,
            headers={
                "Content-Disposition": (
                    "attachment; "
                    f"filename*=UTF-8''{encoded_filename}"
                ),
                "Content-Length": str(
                    len(contents)
                ),
                "Cache-Control": "private, no-store",
            },
        )

    file_path = get_existing_cedis_file_path(
        cedis_file
    )

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )
