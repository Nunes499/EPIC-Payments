from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.crud.calendar_file import (
    get_calendar_file_by_id,
    get_files_by_date,
)
from app.database.session import get_db
from app.schemas.calendar_file import CalendarFileRead
from app.services.calendar_service import (
    get_existing_calendar_file_path,
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
    db: Session = Depends(get_db),
):
    calendar_file = await save_calendar_file(
        db,
        calendar_date=calendar_date,
        upload=upload,
        uploaded_by_id=None,
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
    "/{file_id}/download",
    response_class=FileResponse,
)
def download_calendar_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    calendar_file = get_calendar_file_by_id(
        db,
        file_id,
    )

    if calendar_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    file_path = get_existing_calendar_file_path(
        calendar_file,
    )

    return FileResponse(
        path=file_path,
        filename=calendar_file.original_filename,
        media_type=calendar_file.mime_type
        or "application/octet-stream",
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