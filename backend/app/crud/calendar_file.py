from datetime import date

from sqlalchemy import func, select
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
    calendar_file = CalendarFile(
        calendar_date=calendar_date,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_type=file_type,
        mime_type=mime_type,
        file_size=file_size,
        file_path=file_path,
        uploaded_by_id=uploaded_by_id,
    )

    db.add(calendar_file)
    db.commit()
    db.refresh(calendar_file)

    return calendar_file


def get_calendar_file_by_id(
    db: Session,
    file_id: int,
) -> CalendarFile | None:
    statement = select(CalendarFile).where(
        CalendarFile.id == file_id
    )

    return db.scalar(statement)


def get_files_by_date(
    db: Session,
    calendar_date: date,
) -> list[CalendarFile]:
    statement = (
        select(CalendarFile)
        .where(CalendarFile.calendar_date == calendar_date)
        .order_by(CalendarFile.uploaded_at.asc())
    )

    return list(db.scalars(statement).all())


def get_files_by_year(
    db: Session,
    year: int,
) -> list[CalendarFile]:
    statement = (
        select(CalendarFile)
        .where(
            func.extract(
                "year",
                CalendarFile.calendar_date,
            )
            == year
        )
        .order_by(
            CalendarFile.calendar_date.asc(),
            CalendarFile.uploaded_at.asc(),
        )
    )

    return list(db.scalars(statement).all())


def count_files_by_date(
    db: Session,
    calendar_date: date,
) -> int:
    statement = (
        select(func.count(CalendarFile.id))
        .where(CalendarFile.calendar_date == calendar_date)
    )

    return int(db.scalar(statement) or 0)


def delete_calendar_file(
    db: Session,
    calendar_file: CalendarFile,
) -> None:
    db.delete(calendar_file)
    db.commit()