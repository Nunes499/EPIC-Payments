from datetime import date
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
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
    BankHistoryResponse,
    BankSearchResponse,
    CalendarDaySummary,
    CalendarFileRead,
)
from app.services.bank_search_service import (
    get_bank_history,
    get_bank_index_status,
    rebuild_bank_index,
    search_bank_candidates,
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


@router.post(
    "/bank-index/rebuild",
)
def rebuild_search_bank_index(
    months: int = Query(
        36,
        description=(
            "Período a indexar: 3, 6, 12, 24 ou 36 meses."
        ),
    ),
    db: Session = Depends(get_db),
):
    """
    Reconstrói o índice da Pesquisa Bancária.

    É a operação demorada feita uma vez. Depois disso,
    as pesquisas passam a consultar os movimentos no D1.
    """

    return rebuild_bank_index(
        db,
        months=months,
    )


@router.get(
    "/bank-index/status",
)
def read_search_bank_index_status(
    db: Session = Depends(get_db),
):
    """
    Mostra quantos ficheiros e movimentos estão indexados.
    """

    return get_bank_index_status(
        db
    )


@router.get(
    "/bank-search",
    response_model=BankSearchResponse,
)
def search_bank_history_candidates(
    q: str = Query(
        ...,
        min_length=2,
        description=(
            "Número de referência ou nome do titular."
        ),
    ),
    db: Session = Depends(get_db),
):
    """
    Pesquisa número de referência ou nome do titular.

    Os ficheiros novos são indexados automaticamente.
    Os ficheiros já indexados não são relidos a cada pesquisa.
    """

    return search_bank_candidates(
        db,
        query=q,
    )


@router.get(
    "/bank-history",
    response_model=BankHistoryResponse,
)
def read_bank_history(
    q: str = Query(
        ...,
        min_length=2,
        description=(
            "A mesma pesquisa usada para encontrar o candidato."
        ),
    ),
    candidate_id: str = Query(...),
    months: int = Query(
        3,
        description=(
            "3, 6, 12, 24 ou 36 meses."
        ),
    ),
    db: Session = Depends(get_db),
):
    """
    Histórico Bancário documental.

    Não conclui se uma mensalidade está paga ou em dívida.
    O tipo do evento é inferido pelo conteúdo do ficheiro,
    mesmo que o ficheiro tenha sido colocado apenas na zona PDF/XML.
    """

    return get_bank_history(
        db,
        query=q,
        candidate_id=candidate_id,
        months=months,
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
