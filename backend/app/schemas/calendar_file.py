from datetime import date, datetime

from pydantic import BaseModel


class CalendarFileRead(BaseModel):
    id: int
    calendar_date: date
    original_filename: str
    stored_filename: str
    file_type: str
    mime_type: str | None
    file_size: int | None
    uploaded_at: datetime

    model_config = {
        "from_attributes": True
    }