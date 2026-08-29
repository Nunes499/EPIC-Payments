from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class CalendarFileRead(BaseModel):
    id: int
    calendar_date: date

    original_filename: str
    stored_filename: str

    # Formato físico:
    # pdf / xml / report
    file_type: str

    # Função bancária:
    # normal / returned / recovery
    file_category: str = "normal"

    # Apenas para recuperação:
    # None = não é recuperação
    # 1 = Ficheiro 1
    # 2 = Ficheiro 2
    recovery_part: int | None = None

    related_file_id: int | None = None

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
    recovery_count: int
    report_count: int


class BankMovementRead(BaseModel):
    sequence: int

    original_member_reference: str
    member_number: str

    name: str

    # Conta bancária utilizada no movimento
    iban: str | None = None

    # Dados encontrados na Base CEDIS
    cedis_name: str | None = None

    phone: str | None = None
    email: str | None = None

    birth_year: int | None = None
    age: int | None = None

    is_minor: bool = False
    cedis_match: bool = False

    # Dados bancários
    amount: Decimal

    reason_code: str
    reason_description: str

    collection_date: date | None = None
    bank_reference: str | None = None


class BankFileProcessingRead(BaseModel):
    file_id: int

    filename: str
    file_type: str

    cedis_file_id: int | None = None
    cedis_filename: str | None = None

    cedis_matches: int = 0
    cedis_unmatched: int = 0

    minor_members: int = 0

    message_id: str | None = None
    original_message_id: str | None = None

    declared_transactions: int | None = None
    declared_total_amount: Decimal | None = None

    parsed_transactions: int
    parsed_total_amount: Decimal

    movements: list[BankMovementRead]


class BankSearchCandidateRead(BaseModel):
    candidate_id: str

    searched_reference: str | None = None

    bank_reference_code: str
    holder_name: str
    iban: str | None = None

    match_type: str
    match_score: int

    movement_count: int = 0
    last_movement_date: date | None = None


class BankSearchResponse(BaseModel):
    query: str
    candidates: list[BankSearchCandidateRead]


class BankHistoryDocumentRead(BaseModel):
    file_id: int
    filename: str

    file_type: str
    file_category: str

    download_url: str


class BankHistoryEventRead(BaseModel):
    event_id: str

    event_date: date
    event_type: str

    bank_reference_code: str
    holder_name: str
    iban: str | None = None

    amount: Decimal

    reason_code: str
    reason_description: str

    collection_reference: str | None = None

    message_id: str | None = None
    original_message_id: str | None = None

    recovery_part: int | None = None
    related_file_id: int | None = None

    documents: list[BankHistoryDocumentRead]


class BankHistoryResponse(BaseModel):
    candidate_id: str

    bank_reference_code: str
    holder_name: str
    iban: str | None = None

    months: int

    start_date: date
    end_date: date

    events: list[BankHistoryEventRead]
