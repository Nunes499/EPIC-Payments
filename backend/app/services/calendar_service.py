from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.crud.calendar_file import (
    create_calendar_file,
    delete_calendar_file,
    get_calendar_file_by_id,
)
from app.crud.cedis_file import get_active_cedis_file
from app.models.calendar_file import CalendarFile
from app.services.cedis_service import (
    clean_cell_value,
    clean_integer_value,
    load_cedis_dataframe,
)
from app.services.bank_reason_codes import (
    get_reason_description,
)
from app.services.r2_storage import (
    delete_object_from_r2,
    download_bytes_from_r2,
    upload_bytes_to_r2,
)


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


def build_r2_object_key(
    *,
    calendar_date: date,
    file_type: str,
    stored_filename: str,
) -> str:
    """
    Cria a chave privada usada no Cloudflare R2.

    Exemplo:
    bank-files/2026/08/2026-08-20/xml/abc123.xml
    """

    folder_name_by_type = {
        "pdf": "pdf",
        "xml": "xml",
        "report": "reports",
    }

    type_folder = folder_name_by_type[
        file_type
    ]

    return (
        "bank-files/"
        f"{calendar_date.year}/"
        f"{calendar_date.month:02d}/"
        f"{calendar_date.isoformat()}/"
        f"{type_folder}/"
        f"{stored_filename}"
    )


def build_r2_file_path(
    object_key: str,
) -> str:
    """
    Valor guardado em calendar_files.file_path
    para distinguir ficheiros cloud dos antigos locais.
    """

    return f"r2://{object_key}"


def is_r2_file_path(
    file_path: str,
) -> bool:
    return file_path.startswith(
        "r2://"
    )


def get_r2_object_key(
    calendar_file: CalendarFile,
) -> str:
    file_path = (
        calendar_file.file_path
        or ""
    )

    if not is_r2_file_path(
        file_path
    ):
        raise ValueError(
            "O ficheiro não está armazenado no R2."
        )

    return file_path[
        len("r2://"):
    ]


async def save_calendar_file(
    db: Session,
    *,
    calendar_date: date,
    upload: UploadFile,
    uploaded_by_id: int | None = None,
) -> CalendarFile:
    """
    Guarda novos ficheiros bancários diretamente
    no Cloudflare R2.

    Se o registo na base de dados falhar,
    o objeto enviado para o R2 é removido.
    """

    if not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    file_type = get_file_type(
        upload.filename,
    )

    contents = await upload.read()

    try:
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

        extension = Path(
            upload.filename,
        ).suffix.lower()

        stored_filename = (
            f"{uuid4().hex}{extension}"
        )

        object_key = build_r2_object_key(
            calendar_date=calendar_date,
            file_type=file_type,
            stored_filename=stored_filename,
        )

        upload_bytes_to_r2(
            object_key=object_key,
            contents=contents,
            content_type=upload.content_type,
        )

        try:
            calendar_file = create_calendar_file(
                db,
                calendar_date=calendar_date,
                original_filename=upload.filename,
                stored_filename=stored_filename,
                file_type=file_type,
                mime_type=upload.content_type,
                file_size=len(contents),
                file_path=build_r2_file_path(
                    object_key
                ),
                uploaded_by_id=uploaded_by_id,
            )

            return calendar_file

        except Exception:
            # Evita deixar um objeto órfão no R2
            # se a gravação da BD falhar.
            try:
                delete_object_from_r2(
                    object_key=object_key,
                )
            except Exception:
                pass

            raise

    finally:
        await upload.close()


def resolve_calendar_file_path(
    calendar_file: CalendarFile,
) -> Path:
    """
    Resolve apenas ficheiros antigos guardados localmente.
    """

    file_path = Path(
        calendar_file.file_path,
    )

    if not file_path.is_absolute():
        file_path = (
            Path.cwd()
            / file_path
        )

    return file_path.resolve()


def get_existing_calendar_file_path(
    calendar_file: CalendarFile,
) -> Path:
    """
    Compatibilidade com ficheiros antigos locais.

    Ficheiros novos no R2 devem ser obtidos através
    de get_calendar_file_contents().
    """

    if is_r2_file_path(
        calendar_file.file_path
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Este ficheiro está armazenado online "
                "no Cloudflare R2 e não possui caminho local."
            ),
        )

    file_path = resolve_calendar_file_path(
        calendar_file,
    )

    if (
        not file_path.exists()
        or not file_path.is_file()
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "O ficheiro físico não foi "
                "encontrado no servidor."
            ),
        )

    return file_path


def get_calendar_file_contents(
    calendar_file: CalendarFile,
) -> bytes:
    """
    Obtém o conteúdo de um ficheiro independentemente
    de estar no R2 ou no armazenamento local antigo.
    """

    if is_r2_file_path(
        calendar_file.file_path
    ):
        object_key = get_r2_object_key(
            calendar_file
        )

        return download_bytes_from_r2(
            object_key=object_key,
        )

    file_path = get_existing_calendar_file_path(
        calendar_file
    )

    return file_path.read_bytes()


def remove_calendar_file(
    db: Session,
    *,
    file_id: int,
) -> CalendarFile:
    """
    Remove o ficheiro do armazenamento correspondente.

    Mantém compatibilidade com ficheiros locais antigos.
    """

    calendar_file = get_calendar_file_by_id(
        db,
        file_id,
    )

    if calendar_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    if is_r2_file_path(
        calendar_file.file_path
    ):
        object_key = get_r2_object_key(
            calendar_file
        )

        delete_object_from_r2(
            object_key=object_key,
        )

        delete_calendar_file(
            db,
            calendar_file,
        )

        return calendar_file

    file_path = resolve_calendar_file_path(
        calendar_file
    )

    delete_calendar_file(
        db,
        calendar_file,
    )

    if (
        file_path.exists()
        and file_path.is_file()
    ):
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
    """
    Limpa apenas a antiga estrutura local,
    sem tocar no armazenamento R2.
    """

    current_directory = (
        start_directory.resolve()
    )

    resolved_stop_directory = (
        stop_directory.resolve()
    )

    while (
        current_directory
        != resolved_stop_directory
        and resolved_stop_directory
        in current_directory.parents
    ):
        try:
            current_directory.rmdir()
        except OSError:
            break

        current_directory = (
            current_directory.parent
        )


# =========================================================
# PROCESSAMENTO XML BANCÁRIO
# =========================================================


def normalize_member_reference(
    reference: str,
) -> str:
    """
    Preserva a referência original do banco,
    mas cria uma versão candidata ao nº de sócio.

    Exemplos:
        200520 -> 200520
        A200520 -> 200520
        B669 -> 669
        C1000233 -> 1000233

    A validação definitiva contra a CEDIS
    será feita numa etapa posterior.
    """

    cleaned = (
        reference
        .strip()
        .replace(" ", "")
    )

    if cleaned.isdigit():
        return cleaned

    match = re.fullmatch(
        r"[A-Za-z]+(\d+)",
        cleaned,
    )

    if match:
        return match.group(1)

    return cleaned


def parse_decimal(
    value: str | None,
) -> Decimal:
    if not value:
        return Decimal("0")

    try:
        return Decimal(
            value.strip(),
        )
    except InvalidOperation:
        return Decimal("0")


def parse_optional_date(
    value: str | None,
) -> date | None:
    if not value:
        return None

    try:
        return date.fromisoformat(
            value.strip(),
        )
    except ValueError:
        return None


def build_active_cedis_lookup(
    db: Session,
) -> tuple[
    dict[str, dict],
    int | None,
    str | None,
]:
    """
    Carrega a Base CEDIS ativa e cria um índice
    por Nº Cartão / Nº Sócio.

    O cruzamento é feito pelo número de sócio normalizado.
    Exemplos:
        A200520 -> 200520
        B669 -> 669
        210445 -> 210445
    """

    active_cedis_file = get_active_cedis_file(
        db,
    )

    if active_cedis_file is None:
        return (
            {},
            None,
            None,
        )

    dataframe = load_cedis_dataframe(
        active_cedis_file,
    )

    lookup: dict[str, dict] = {}

    for _, row in dataframe.iterrows():
        raw_member_number = clean_cell_value(
            row.get("Nº Cartão"),
        )

        if not raw_member_number:
            continue

        member_number = normalize_member_reference(
            raw_member_number,
        )

        if not member_number:
            continue

        # Se existirem números repetidos na exportação,
        # preservamos a primeira ocorrência.
        if member_number in lookup:
            continue

        age = clean_integer_value(
            row.get("Idade (Anos)"),
        )

        birth_year = clean_integer_value(
            row.get("Ano de Nascimento"),
        )

        lookup[member_number] = {
            "member_number":
                member_number,

            "name":
                clean_cell_value(
                    row.get("Nome"),
                ),

            "phone":
                clean_cell_value(
                    row.get(
                        "NºTelefone/Telemóvel",
                    ),
                ),

            "email":
                clean_cell_value(
                    row.get(
                        "Endereço de e-mail",
                    ),
                ),

            "birth_year":
                birth_year,

            "age":
                age,

            "is_minor":
                (
                    age is not None
                    and age < 18
                ),
        }

    return (
        lookup,
        active_cedis_file.id,
        active_cedis_file.original_filename,
    )


def process_xml_calendar_file(
    db: Session,
    *,
    file_id: int,
) -> dict:
    calendar_file = get_calendar_file_by_id(
        db,
        file_id,
    )

    if calendar_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    if calendar_file.file_type != "xml":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Nesta fase apenas ficheiros XML "
                "podem ser processados."
            ),
        )

    contents = get_calendar_file_contents(
        calendar_file,
    )

    try:
        root = ET.fromstring(
            contents,
        )
    except ET.ParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "O ficheiro XML não é válido "
                "ou está corrompido."
            ),
        ) from exc

    namespace_uri = ""

    if root.tag.startswith("{"):
        namespace_uri = (
            root.tag[1:]
            .split("}", 1)[0]
        )

    def tag(name: str) -> str:
        if namespace_uri:
            return (
                f"{{{namespace_uri}}}{name}"
            )

        return name

    def find_text(
        element: ET.Element,
        path: list[str],
    ) -> str | None:
        current = element

        for item in path:
            found = current.find(
                tag(item),
            )

            if found is None:
                return None

            current = found

        if current.text is None:
            return None

        return current.text.strip()

    customer_report = root.find(
        tag("CstmrPmtStsRpt"),
    )

    if customer_report is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "O XML não contém um relatório "
                "bancário reconhecido."
            ),
        )

    message_id = find_text(
        customer_report,
        [
            "GrpHdr",
            "MsgId",
        ],
    )

    original_group = (
        customer_report.find(
            tag("OrgnlGrpInfAndSts"),
        )
    )

    original_message_id = None
    declared_transactions = None
    declared_total_amount = None

    if original_group is not None:
        original_message_id = (
            find_text(
                original_group,
                ["OrgnlMsgId"],
            )
        )

        declared_transactions_text = (
            find_text(
                original_group,
                ["OrgnlNbOfTxs"],
            )
        )

        if declared_transactions_text:
            try:
                declared_transactions = int(
                    declared_transactions_text,
                )
            except ValueError:
                declared_transactions = None

        declared_total_amount = (
            parse_decimal(
                find_text(
                    original_group,
                    ["OrgnlCtrlSum"],
                ),
            )
        )

    (
        cedis_lookup,
        cedis_file_id,
        cedis_filename,
    ) = build_active_cedis_lookup(
        db,
    )

    movements: list[dict] = []

    payment_groups = (
        customer_report.findall(
            tag("OrgnlPmtInfAndSts"),
        )
    )

    sequence = 0

    for payment_group in payment_groups:
        transactions = (
            payment_group.findall(
                tag("TxInfAndSts"),
            )
        )

        for transaction in transactions:
            sequence += 1

            reason_code = (
                find_text(
                    transaction,
                    [
                        "StsRsnInf",
                        "Rsn",
                        "Cd",
                    ],
                )
                or find_text(
                    transaction,
                    [
                        "StsRsnInf",
                        "Rsn",
                        "Prtry",
                    ],
                )
                or ""
            )

            bank_reference = find_text(
                transaction,
                ["AcctSvcrRef"],
            )

            original_tx_ref = (
                transaction.find(
                    tag("OrgnlTxRef"),
                )
            )

            if original_tx_ref is None:
                continue

            amount = parse_decimal(
                find_text(
                    original_tx_ref,
                    [
                        "Amt",
                        "InstdAmt",
                    ],
                ),
            )

            collection_date = (
                parse_optional_date(
                    find_text(
                        original_tx_ref,
                        ["ReqdColltnDt"],
                    ),
                )
            )

            original_member_reference = (
                find_text(
                    original_tx_ref,
                    [
                        "MndtRltdInf",
                        "MndtId",
                    ],
                )
                or ""
            )

            member_number = (
                normalize_member_reference(
                    original_member_reference,
                )
            )

            name = (
                find_text(
                    original_tx_ref,
                    [
                        "Dbtr",
                        "Pty",
                        "Nm",
                    ],
                )
                or ""
            )

            cedis_member = cedis_lookup.get(
                member_number,
            )

            cedis_match = (
                cedis_member is not None
            )

            cedis_name = (
                cedis_member.get("name")
                if cedis_member
                else None
            )

            phone = (
                cedis_member.get("phone")
                if cedis_member
                else None
            )

            email = (
                cedis_member.get("email")
                if cedis_member
                else None
            )

            birth_year = (
                cedis_member.get("birth_year")
                if cedis_member
                else None
            )

            age = (
                cedis_member.get("age")
                if cedis_member
                else None
            )

            is_minor = (
                bool(
                    cedis_member.get("is_minor")
                )
                if cedis_member
                else False
            )

            movements.append(
                {
                    "sequence":
                        sequence,

                    "original_member_reference":
                        original_member_reference,

                    "member_number":
                        member_number,

                    # Mantemos o nome do XML como principal.
                    # Se estiver vazio, usamos o nome da CEDIS.
                    "name":
                        name or cedis_name or "",

                    "cedis_name":
                        cedis_name,

                    "phone":
                        phone,

                    "email":
                        email,

                    "birth_year":
                        birth_year,

                    "age":
                        age,

                    "is_minor":
                        is_minor,

                    "cedis_match":
                        cedis_match,

                    "amount":
                        amount,

                    "reason_code":
                        reason_code,

                    "reason_description":
                        get_reason_description(
                            reason_code,
                        ),

                    "collection_date":
                        collection_date,

                    "bank_reference":
                        bank_reference,
                }
            )

    parsed_total_amount = sum(
        (
            movement["amount"]
            for movement in movements
        ),
        Decimal("0"),
    )

    cedis_matches = sum(
        1
        for movement in movements
        if movement["cedis_match"]
    )

    cedis_unmatched = (
        len(movements)
        - cedis_matches
    )

    minor_members = sum(
        1
        for movement in movements
        if movement["is_minor"]
    )

    return {
        "file_id":
            calendar_file.id,

        "filename":
            calendar_file.original_filename,

        "file_type":
            calendar_file.file_type,

        "cedis_file_id":
            cedis_file_id,

        "cedis_filename":
            cedis_filename,

        "cedis_matches":
            cedis_matches,

        "cedis_unmatched":
            cedis_unmatched,

        "minor_members":
            minor_members,

        "message_id":
            message_id,

        "original_message_id":
            original_message_id,

        "declared_transactions":
            declared_transactions,

        "declared_total_amount":
            declared_total_amount,

        "parsed_transactions":
            len(movements),

        "parsed_total_amount":
            parsed_total_amount,

        "movements":
            movements,
    }