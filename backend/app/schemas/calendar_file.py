from datetime import date, datetime

from pydantic import BaseModel


class CalendarFileRead(BaseModel):
    id: int
    calendar_date: date

    original_filename: str
    stored_filename: str

    file_type: str

    mime_type: str | None = None
    file_size: int | None = None

    file_path: str

    uploaded_at: datetime

    model_config = {
        "from_attributes": True,
    }


class CalendarDaySummary(BaseModel):
    calendar_date: date
    total_files: int
    pdf_count: int
    xml_count: int
    report_count: int