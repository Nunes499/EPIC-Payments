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

    # Descrição do motivo bancário.
    #
    # Exemplos:
    # AM04 -> Insuficiência de fundos.
    # RJ11 -> Autorização está inativa...
    #
    # Para códigos novos:
    # "Novo tipo de código — verifique a descrição
    # no formato PDF."
    reason_description: str

    collection_date: date | None = None

    bank_reference: str | None = None


class BankFileProcessingRead(BaseModel):
    file_id: int

    filename: str
    file_type: str

    # Base CEDIS utilizada no processamento
    cedis_file_id: int | None = None
    cedis_filename: str | None = None

    # Correspondências com a Base CEDIS
    cedis_matches: int = 0
    cedis_unmatched: int = 0

    # Quantidade de menores encontrados
    minor_members: int = 0

    # Informação bancária do ficheiro XML
    message_id: str | None = None
    original_message_id: str | None = None

    declared_transactions: int | None = None
    declared_total_amount: Decimal | None = None

    parsed_transactions: int
    parsed_total_amount: Decimal

    movements: list[BankMovementRead]