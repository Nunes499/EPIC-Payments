from datetime import date, datetime
from decimal import Decimal

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


class BankMovementRead(BaseModel):
    sequence: int

    original_member_reference: str
    member_number: str

    name: str

    amount: Decimal
    reason_code: str

    collection_date: date | None = None

    bank_reference: str | None = None


class BankFileProcessingRead(BaseModel):
    file_id: int
    filename: str
    file_type: str

    message_id: str | None = None
    original_message_id: str | None = None

    declared_transactions: int | None = None
    declared_total_amount: Decimal | None = None

    parsed_transactions: int
    parsed_total_amount: Decimal

    movements: list[BankMovementRead]