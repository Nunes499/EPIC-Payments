from datetime import date

from sqlalchemy import case, func, select
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


def get_year_summary(
    db: Session,
    year: int,
) -> list[dict]:
    statement = (
        select(
            CalendarFile.calendar_date,
            func.count(CalendarFile.id).label("total_files"),
            func.sum(
                case(
                    (CalendarFile.file_type == "pdf", 1),
                    else_=0,
                )
            ).label("pdf_count"),
            func.sum(
                case(
                    (CalendarFile.file_type == "xml", 1),
                    else_=0,
                )
            ).label("xml_count"),
            func.sum(
                case(
                    (CalendarFile.file_type == "report", 1),
                    else_=0,
                )
            ).label("report_count"),
        )
        .where(
            func.extract(
                "year",
                CalendarFile.calendar_date,
            )
            == year
        )
        .group_by(CalendarFile.calendar_date)
        .order_by(CalendarFile.calendar_date.asc())
    )

    rows = db.execute(statement).all()

    return [
        {
            "calendar_date": row.calendar_date,
            "total_files": int(row.total_files or 0),
            "pdf_count": int(row.pdf_count or 0),
            "xml_count": int(row.xml_count or 0),
            "report_count": int(row.report_count or 0),
        }
        for row in rows
    ]


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