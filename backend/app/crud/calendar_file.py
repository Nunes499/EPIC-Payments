from datetime import date

from sqlalchemy.orm import Session

from app.models.calendar_file import CalendarFile


def create_calendar_file(
    db: Session,
    *,
    calendar_date: date,
    original_filename: str,
    stored_filename: str,
    file_type: str,
    mime_type: str | None,
    file_size: int | None,
    file_path: str,
    uploaded_by_id: int | None,
) -> CalendarFile:

    file = CalendarFile(
        calendar_date=calendar_date,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_type=file_type,
        mime_type=mime_type,
        file_size=file_size,
        file_path=file_path,
        uploaded_by_id=uploaded_by_id,
    )

    db.add(file)
    db.commit()
    db.refresh(file)

    return file


def get_files_by_date(
    db: Session,
    calendar_date: date,
):

    return (
        db.query(CalendarFile)
        .filter(
            CalendarFile.calendar_date == calendar_date
        )
        .order_by(CalendarFile.uploaded_at)
        .all()
    )
