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
    """
    Devolve a versão atualmente ativa
    da Base de Dados CEDIS.
    """

    return get_active_cedis_file(db)


@router.get(
    "/history",
    response_model=list[CedisFileRead],
)
def list_cedis_history(
    db: Session = Depends(get_db),
):
    """
    Devolve todas as versões da Base CEDIS,
    da mais recente para a mais antiga.
    """

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
    """
    Recebe uma nova Base CEDIS.

    O ficheiro é validado antes de substituir
    a versão atualmente ativa.

    Se a validação falhar, a base ativa
    permanece inalterada.
    """

    return await save_cedis_file(
        db,
        upload=upload,
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
    """
    Permite visualizar os dados da Base CEDIS
    diretamente na interface do EPIC Payments.

    A leitura funciona tanto para versões antigas
    armazenadas localmente como para versões
    armazenadas no Cloudflare R2.
    """

    if limit < 1:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "O limite deve ser superior a zero."
            ),
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
    """
    Descarrega uma versão da Base CEDIS
    mantendo o nome original do ficheiro.

    Versões antigas:
        são servidas através do ficheiro local.

    Versões Cloudflare R2:
        são obtidas diretamente do R2 e enviadas
        ao utilizador sem necessidade de criar
        uma cópia permanente no disco do servidor.
    """

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

    # =====================================================
    # CLOUDFLARE R2
    # =====================================================

    if is_r2_file_path(
        cedis_file.file_path
    ):
        try:
            contents = (
                get_cedis_file_contents(
                    cedis_file
                )
            )

        except HTTPException:
            raise

        except Exception as exc:
            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "Não foi possível obter "
                    "a Base CEDIS do "
                    "Cloudflare R2."
                ),
            ) from exc

        encoded_filename = quote(
            filename
        )

        return StreamingResponse(
            BytesIO(
                contents
            ),
            media_type=media_type,
            headers={
                "Content-Disposition": (
                    "attachment; "
                    f"filename*=UTF-8''{encoded_filename}"
                ),
                "Content-Length": str(
                    len(contents)
                ),
                "Cache-Control": (
                    "private, no-store"
                ),
            },
        )

    # =====================================================
    # ARMAZENAMENTO LOCAL LEGADO
    # =====================================================

    file_path = (
        get_existing_cedis_file_path(
            cedis_file
        )
    )

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )