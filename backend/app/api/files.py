from datetime import date
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.crud.calendar_file import (
    get_calendar_file_by_id,
    get_files_by_date,
    get_year_summary,
)
from app.database.session import get_db
from app.schemas.calendar_file import (
    BankFileProcessingRead,
    CalendarDaySummary,
    CalendarFileRead,
)
from app.services.calendar_service import (
    get_calendar_file_contents,
    process_calendar_file as process_bank_calendar_file,
    remove_calendar_file,
    save_calendar_file,
)


router = APIRouter(
    prefix="/files",
    tags=["Files"],
)


@router.post(
    "/calendar/{calendar_date}",
    response_model=CalendarFileRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_calendar_file(
    calendar_date: date,
    upload: UploadFile = File(...),
    file_category: str = Form("normal"),
    recovery_part: int | None = Form(None),
    related_file_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    """
    Carrega um ficheiro bancário para o calendário.

    Categorias suportadas:

    normal
        Ficheiro normal de cobrança.
        Pode ser PDF ou XML.

    returned
        Ficheiro de devoluções bancárias.

    recovery
        Ficheiro de recuperação.
        Deve indicar recovery_part 1 ou 2.

    Para Recovery F2, related_file_id deve conter
    o ID do respetivo Recovery F1.

    Se file_category não for enviado, mantém-se
    compatibilidade com o frontend antigo e o
    ficheiro é tratado como normal.
    """

    calendar_file = await save_calendar_file(
        db,
        calendar_date=calendar_date,
        upload=upload,
        uploaded_by_id=None,
        file_category=file_category,
        recovery_part=recovery_part,
        related_file_id=related_file_id,
    )

    return calendar_file


@router.get(
    "/calendar/{calendar_date}",
    response_model=list[CalendarFileRead],
)
def list_calendar_files(
    calendar_date: date,
    db: Session = Depends(get_db),
):
    return get_files_by_date(
        db,
        calendar_date,
    )


@router.get(
    "/year/{year}",
    response_model=list[CalendarDaySummary],
)
def list_year_summary(
    year: int,
    db: Session = Depends(get_db),
):
    return get_year_summary(
        db,
        year,
    )


@router.get(
    "/{file_id}/process",
    response_model=BankFileProcessingRead,
)
def process_calendar_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    return process_bank_calendar_file(
        db,
        file_id=file_id,
    )


@router.get(
    "/{file_id}/download",
)
def download_calendar_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    """
    Descarrega ficheiros novos guardados no R2
    e mantém compatibilidade com ficheiros locais antigos.
    """

    calendar_file = get_calendar_file_by_id(
        db,
        file_id,
    )

    if calendar_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    contents = get_calendar_file_contents(
        calendar_file,
    )

    encoded_filename = quote(
        calendar_file.original_filename
    )

    return Response(
        content=contents,
        media_type=(
            calendar_file.mime_type
            or "application/octet-stream"
        ),
        headers={
            "Content-Disposition": (
                "attachment; "
                f"filename*=UTF-8''{encoded_filename}"
            ),
        },
    )


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    remove_calendar_file(
        db,
        file_id=file_id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )