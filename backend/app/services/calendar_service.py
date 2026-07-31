from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.crud.calendar_file import (
    create_calendar_file,
    delete_calendar_file,
    get_calendar_file_by_id,
)
from app.models.calendar_file import CalendarFile


ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".xml": "xml",
    ".xlsx": "report",
    ".xls": "report",
}

MAX_FILE_SIZE = 25 * 1024 * 1024

STORAGE_ROOT = Path("storage")
BANK_FILES_ROOT = STORAGE_ROOT / "bank_files"


def get_file_type(filename: str) -> str:
    extension = Path(filename).suffix.lower()

    file_type = ALLOWED_EXTENSIONS.get(extension)

    if file_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Formato de ficheiro não permitido. "
                "São aceites PDF, XML, XLSX e XLS."
            ),
        )

    return file_type


def build_destination_directory(
    calendar_date: date,
    file_type: str,
) -> Path:
    folder_name_by_type = {
        "pdf": "pdf",
        "xml": "xml",
        "report": "reports",
    }

    type_folder = folder_name_by_type[file_type]

    destination = (
        BANK_FILES_ROOT
        / str(calendar_date.year)
        / f"{calendar_date.month:02d}"
        / calendar_date.isoformat()
        / type_folder
    )

    destination.mkdir(
        parents=True,
        exist_ok=True,
    )

    return destination


async def save_calendar_file(
    db: Session,
    *,
    calendar_date: date,
    upload: UploadFile,
    uploaded_by_id: int | None = None,
) -> CalendarFile:
    if not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    file_type = get_file_type(upload.filename)

    contents = await upload.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro está vazio.",
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="O ficheiro excede o limite máximo de 25 MB.",
        )

    destination_directory = build_destination_directory(
        calendar_date=calendar_date,
        file_type=file_type,
    )

    extension = Path(upload.filename).suffix.lower()

    stored_filename = f"{uuid4().hex}{extension}"

    absolute_file_path = (
        destination_directory
        / stored_filename
    )

    relative_file_path = absolute_file_path.relative_to(
        STORAGE_ROOT.parent
    )

    try:
        absolute_file_path.write_bytes(contents)

        calendar_file = create_calendar_file(
            db,
            calendar_date=calendar_date,
            original_filename=upload.filename,
            stored_filename=stored_filename,
            file_type=file_type,
            mime_type=upload.content_type,
            file_size=len(contents),
            file_path=str(relative_file_path),
            uploaded_by_id=uploaded_by_id,
        )

        return calendar_file

    except Exception:
        if absolute_file_path.exists():
            absolute_file_path.unlink()

        raise

    finally:
        await upload.close()


def resolve_calendar_file_path(
    calendar_file: CalendarFile,
) -> Path:
    file_path = Path(calendar_file.file_path)

    if not file_path.is_absolute():
        file_path = Path.cwd() / file_path

    return file_path.resolve()


def get_existing_calendar_file_path(
    calendar_file: CalendarFile,
) -> Path:
    file_path = resolve_calendar_file_path(calendar_file)

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="O ficheiro físico não foi encontrado no servidor.",
        )

    return file_path


def remove_calendar_file(
    db: Session,
    *,
    file_id: int,
) -> CalendarFile:
    calendar_file = get_calendar_file_by_id(
        db,
        file_id,
    )

    if calendar_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    file_path = resolve_calendar_file_path(calendar_file)

    delete_calendar_file(
        db,
        calendar_file,
    )

    if file_path.exists() and file_path.is_file():
        file_path.unlink()

    remove_empty_parent_directories(
        start_directory=file_path.parent,
        stop_directory=BANK_FILES_ROOT,
    )

    return calendar_file


def remove_empty_parent_directories(
    *,
    start_directory: Path,
    stop_directory: Path,
) -> None:
    current_directory = start_directory.resolve()
    resolved_stop_directory = stop_directory.resolve()

    while (
        current_directory != resolved_stop_directory
        and resolved_stop_directory
        in current_directory.parents
    ):
        try:
            current_directory.rmdir()
        except OSError:
            break

        current_directory = current_directory.parent