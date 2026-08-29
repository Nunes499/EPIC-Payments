from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.calendar_file import CalendarFile
from app.services.d1_service import (
    execute_d1_query,
    get_d1_rows,
)


def _parse_datetime(
    value: str | None,
) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    normalized = value.strip()

    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.now(timezone.utc)

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed


def _row_to_calendar_file(
    row: dict,
) -> CalendarFile:
    calendar_date_value = row.get("calendar_date")

    if isinstance(calendar_date_value, date):
        calendar_date = calendar_date_value
    else:
        calendar_date = date.fromisoformat(
            str(calendar_date_value)
        )

    file_category = str(
        row.get("file_category") or "normal"
    )

    recovery_part = (
        int(row["recovery_part"])
        if row.get("recovery_part") is not None
        else None
    )

    related_file_id = (
        int(row["related_file_id"])
        if row.get("related_file_id") is not None
        else None
    )

    calendar_file = CalendarFile(
        id=int(row["id"]),
        calendar_date=calendar_date,
        original_filename=str(row["original_filename"]),
        stored_filename=str(row["stored_filename"]),
        file_type=str(row["file_type"]),
        file_category=file_category,
        recovery_part=recovery_part,
        related_file_id=related_file_id,
        mime_type=(
            str(row["mime_type"])
            if row.get("mime_type") is not None
            else None
        ),
        file_size=(
            int(row["file_size"])
            if row.get("file_size") is not None
            else None
        ),
        file_path=str(row["file_path"]),
        uploaded_by_id=(
            int(row["uploaded_by_id"])
            if row.get("uploaded_by_id") is not None
            else None
        ),
    )

    calendar_file.uploaded_at = _parse_datetime(
        row.get("uploaded_at")
    )

    return calendar_file


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
    file_category: str = "normal",
    recovery_part: int | None = None,
    related_file_id: int | None = None,
) -> CalendarFile:
    del db

    uploaded_at = datetime.now(
        timezone.utc
    ).isoformat()

    execute_d1_query(
        """
        INSERT INTO calendar_files (
            calendar_date,
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            calendar_date.isoformat(),
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id,
        ],
    )

    rows = get_d1_rows(
        """
        SELECT
            id,
            calendar_date,
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id
        FROM calendar_files
        WHERE stored_filename = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        [stored_filename],
    )

    if not rows:
        raise RuntimeError(
            "O registo foi enviado para o D1, "
            "mas não pôde ser relido."
        )

    return _row_to_calendar_file(rows[0])


def get_calendar_file_by_id(
    db: Session,
    file_id: int,
) -> CalendarFile | None:
    del db

    rows = get_d1_rows(
        """
        SELECT
            id,
            calendar_date,
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id
        FROM calendar_files
        WHERE id = ?
        LIMIT 1
        """,
        [file_id],
    )

    if not rows:
        return None

    return _row_to_calendar_file(rows[0])


def get_files_by_date(
    db: Session,
    calendar_date: date,
) -> list[CalendarFile]:
    del db

    rows = get_d1_rows(
        """
        SELECT
            id,
            calendar_date,
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id
        FROM calendar_files
        WHERE calendar_date = ?
        ORDER BY uploaded_at ASC, id ASC
        """,
        [calendar_date.isoformat()],
    )

    return [
        _row_to_calendar_file(row)
        for row in rows
    ]


def get_files_between_dates(
    db: Session,
    *,
    start_date: date,
    end_date: date,
) -> list[CalendarFile]:
    """
    Lista PDF/XML bancários entre duas datas.
    Usado pela Pesquisa Bancária.
    """
    del db

    rows = get_d1_rows(
        """
        SELECT
            id,
            calendar_date,
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id
        FROM calendar_files
        WHERE calendar_date >= ?
          AND calendar_date <= ?
          AND file_type IN ('pdf', 'xml')
        ORDER BY calendar_date DESC, uploaded_at DESC, id DESC
        """,
        [
            start_date.isoformat(),
            end_date.isoformat(),
        ],
    )

    return [
        _row_to_calendar_file(row)
        for row in rows
    ]


def get_files_by_year(
    db: Session,
    year: int,
) -> list[CalendarFile]:
    del db

    rows = get_d1_rows(
        """
        SELECT
            id,
            calendar_date,
            original_filename,
            stored_filename,
            file_type,
            mime_type,
            file_size,
            file_path,
            uploaded_at,
            uploaded_by_id,
            file_category,
            recovery_part,
            related_file_id
        FROM calendar_files
        WHERE calendar_date LIKE ?
        ORDER BY calendar_date ASC, uploaded_at ASC, id ASC
        """,
        [f"{year:04d}-%"],
    )

    return [
        _row_to_calendar_file(row)
        for row in rows
    ]


def get_file_counts_by_year(
    db: Session,
    year: int,
) -> list[dict]:
    del db

    rows = get_d1_rows(
        """
        SELECT
            calendar_date,
            COUNT(id) AS total_files,
            SUM(
                CASE
                    WHEN file_type = 'pdf' THEN 1
                    ELSE 0
                END
            ) AS pdf_count,
            SUM(
                CASE
                    WHEN file_type = 'xml' THEN 1
                    ELSE 0
                END
            ) AS xml_count
        FROM calendar_files
        WHERE calendar_date LIKE ?
        GROUP BY calendar_date
        ORDER BY calendar_date ASC
        """,
        [f"{year:04d}-%"],
    )

    return [
        {
            "calendar_date": str(row["calendar_date"]),
            "total_files": int(
                row.get("total_files") or 0
            ),
            "pdf_count": int(
                row.get("pdf_count") or 0
            ),
            "xml_count": int(
                row.get("xml_count") or 0
            ),
        }
        for row in rows
    ]


def get_calendar_summary_by_year(
    db: Session,
    year: int,
) -> list[dict]:
    del db

    rows = get_d1_rows(
        """
        SELECT
            cf.calendar_date AS calendar_date,
            COUNT(cf.id) AS total_files,
            SUM(
                CASE
                    WHEN cf.file_type = 'pdf' THEN 1
                    ELSE 0
                END
            ) AS pdf_count,
            SUM(
                CASE
                    WHEN cf.file_type = 'xml' THEN 1
                    ELSE 0
                END
            ) AS xml_count,
            (
                SELECT COUNT(dr.id)
                FROM daily_reports dr
                WHERE dr.calendar_date = cf.calendar_date
            ) AS report_count
        FROM calendar_files cf
        WHERE cf.calendar_date LIKE ?
        GROUP BY cf.calendar_date
        ORDER BY cf.calendar_date ASC
        """,
        [f"{year:04d}-%"],
    )

    return [
        {
            "calendar_date": str(row["calendar_date"]),
            "total_files": int(
                row.get("total_files") or 0
            ),
            "pdf_count": int(
                row.get("pdf_count") or 0
            ),
            "xml_count": int(
                row.get("xml_count") or 0
            ),
            "report_count": int(
                row.get("report_count") or 0
            ),
        }
        for row in rows
    ]


def get_year_summary(
    db: Session,
    year: int,
) -> list[dict]:
    del db

    rows = get_d1_rows(
        """
        SELECT
            calendar_date,
            COUNT(id) AS total_files,
            SUM(
                CASE
                    WHEN
                        file_type = 'pdf'
                        AND COALESCE(file_category, 'normal') != 'recovery'
                    THEN 1
                    ELSE 0
                END
            ) AS pdf_count,
            SUM(
                CASE
                    WHEN
                        file_type = 'xml'
                        AND COALESCE(file_category, 'normal') != 'recovery'
                    THEN 1
                    ELSE 0
                END
            ) AS xml_count,
            SUM(
                CASE
                    WHEN file_category = 'recovery'
                    THEN 1
                    ELSE 0
                END
            ) AS recovery_count,
            SUM(
                CASE
                    WHEN file_type = 'report'
                    THEN 1
                    ELSE 0
                END
            ) AS report_count
        FROM calendar_files
        WHERE calendar_date LIKE ?
        GROUP BY calendar_date
        ORDER BY calendar_date ASC
        """,
        [f"{year:04d}-%"],
    )

    return [
        {
            "calendar_date": date.fromisoformat(
                str(row["calendar_date"])
            ),
            "total_files": int(
                row.get("total_files") or 0
            ),
            "pdf_count": int(
                row.get("pdf_count") or 0
            ),
            "xml_count": int(
                row.get("xml_count") or 0
            ),
            "recovery_count": int(
                row.get("recovery_count") or 0
            ),
            "report_count": int(
                row.get("report_count") or 0
            ),
        }
        for row in rows
    ]


def count_files_by_date(
    db: Session,
    calendar_date: date,
) -> int:
    del db

    rows = get_d1_rows(
        """
        SELECT COUNT(id) AS total
        FROM calendar_files
        WHERE calendar_date = ?
        """,
        [calendar_date.isoformat()],
    )

    if not rows:
        return 0

    return int(
        rows[0].get("total") or 0
    )


def delete_calendar_file(
    db: Session,
    calendar_file: CalendarFile,
) -> None:
    del db

    execute_d1_query(
        """
        DELETE FROM calendar_files
        WHERE id = ?
        """,
        [calendar_file.id],
    )
