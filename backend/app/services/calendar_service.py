from datetime import date

from io import BytesIO

from decimal import Decimal, InvalidOperation

from pathlib import Path

import re

import xml.etree.ElementTree as ET

from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from pypdf import PdfReader

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

    file_category: str = "normal",

    recovery_part: int | None = None,

    related_file_id: int | None = None,

) -> CalendarFile:

    """

    Guarda novos ficheiros bancários diretamente

    no Cloudflare R2.

    Categorias:

    - normal: ficheiro normal PDF/XML

    - returned: ficheiro de devolvidos

    - recovery: ficheiro de recuperação

    Recuperação:

    - recovery_part = 1 -> Ficheiro 1

    - recovery_part = 2 -> Ficheiro 2

    O Ficheiro 2 de recuperação deve estar

    associado ao respetivo Ficheiro 1.

    """

    if not upload.filename:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="O ficheiro não tem um nome válido.",

        )

    file_category = (

        file_category

        or "normal"

    ).strip().lower()

    allowed_categories = {

        "normal",

        "returned",

        "recovery",

    }

    if file_category not in allowed_categories:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "Categoria de ficheiro inválida. "

                "Utilize normal, returned ou recovery."

            ),

        )

    file_type = get_file_type(

        upload.filename,

    )

    if file_category == "recovery":

        if file_type != "pdf":

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "Os ficheiros de recuperação "

                    "devem estar em formato PDF."

                ),

            )

        if recovery_part not in {1, 2}:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "Os ficheiros de recuperação "

                    "devem indicar Ficheiro 1 ou Ficheiro 2."

                ),

            )

        if recovery_part == 1:

            related_file_id = None

        if recovery_part == 2:

            if related_file_id is None:

                raise HTTPException(

                    status_code=status.HTTP_400_BAD_REQUEST,

                    detail=(

                        "O Ficheiro 2 de recuperação "

                        "tem de estar associado "

                        "ao respetivo Ficheiro 1."

                    ),

                )

            related_file = get_calendar_file_by_id(

                db,

                related_file_id,

            )

            if related_file is None:

                raise HTTPException(

                    status_code=status.HTTP_400_BAD_REQUEST,

                    detail=(

                        "O Ficheiro 1 de recuperação "

                        "selecionado não existe."

                    ),

                )

            if (

                related_file.file_category != "recovery"

                or related_file.recovery_part != 1

            ):

                raise HTTPException(

                    status_code=status.HTTP_400_BAD_REQUEST,

                    detail=(

                        "O Ficheiro 2 só pode ser "

                        "associado a um Ficheiro 1 "

                        "de recuperação."

                    ),

                )

            if related_file.calendar_date != calendar_date:

                raise HTTPException(

                    status_code=status.HTTP_400_BAD_REQUEST,

                    detail=(

                        "Os Ficheiros 1 e 2 de recuperação "

                        "devem pertencer ao mesmo dia "

                        "do calendário."

                    ),

                )

    else:

        recovery_part = None

        if file_category == "normal":

            related_file_id = None

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

                file_category=file_category,

                recovery_part=recovery_part,

                related_file_id=related_file_id,

            )

            return calendar_file

        except Exception:

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

            iban = (

                find_text(

                    original_tx_ref,

                    [

                        "DbtrAcct",

                        "Id",

                        "IBAN",

                    ],

                )

                or None

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

                    "iban":

                        iban,

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

# =========================================================

# PROCESSAMENTO PDF BANCÁRIO

# =========================================================



PDF_ROW_START_PATTERN = re.compile(

    r"^\s*\d+\s+[A-Za-z]*\d+\s+"

)

PDF_ROW_PATTERN = re.compile(

    r"^\s*"

    r"(?P<bank_reference>\d+)\s+"

    r"(?P<member_reference>[A-Za-z]*\d+)\s+"

    r"(?P<name>.+?)\s+"

    r"(?P<iban>PT\d{23})\s+"

    r"(?P<amount>\d[\d.]*,\d{2})\s*€\s+"

    r"(?P<reason_code>[A-Z0-9]{4})\s*-\s*"

    r"(?P<reason_description>.*)"

    r"\s*$"

)



def parse_portuguese_decimal(

    value: str | None,

) -> Decimal:

    """

    Converte valores portugueses como:

        1.476,30 -> Decimal("1476.30")

        44,90    -> Decimal("44.90")

    """

    if not value:

        return Decimal("0")

    normalized = (

        value

        .strip()

        .replace("EUR", "")

        .replace("€", "")

        .replace(" ", "")

        .replace(".", "")

        .replace(",", ".")

    )

    try:

        return Decimal(

            normalized,

        )

    except InvalidOperation:

        return Decimal("0")



def parse_portuguese_date(

    value: str | None,

) -> date | None:

    """

    Converte DD-MM-AAAA para date.

    """

    if not value:

        return None

    match = re.fullmatch(

        r"(\d{2})-(\d{2})-(\d{4})",

        value.strip(),

    )

    if not match:

        return None

    day, month, year = match.groups()

    try:

        return date(

            int(year),

            int(month),

            int(day),

        )

    except ValueError:

        return None



def extract_pdf_metadata(

    full_text: str,

) -> dict:

    """

    Extrai os principais totais e a data do relatório bancário.

    """

    def search_text(

        pattern: str,

    ) -> str | None:

        match = re.search(

            pattern,

            full_text,

            flags=re.IGNORECASE,

        )

        if not match:

            return None

        return match.group(1).strip()

    declared_transactions = None

    transactions_text = search_text(

        r"N[ºo]\s+Total\s+de\s+Registos\s*:\s*(\d+)"

    )

    if transactions_text:

        try:

            declared_transactions = int(

                transactions_text

            )

        except ValueError:

            declared_transactions = None

    total_amount_text = search_text(

        r"Montante\s+Total\s+do\s+Lote\s*:\s*"

        r"([\d.]+,\d{2})\s*EUR"

    )

    if not total_amount_text:

        total_amount_text = search_text(

            r"Montante\s+Total\s+do\s+Ficheiro\s*:\s*"

            r"([\d.]+,\d{2})\s*EUR"

        )

    collection_date_text = search_text(

        r"Data\s+de\s+Liquida[cç][aã]o\s*:\s*"

        r"(\d{2}-\d{2}-\d{4})"

    )

    file_identifier = search_text(

        r"Identifica[cç][aã]o\s+do\s+Ficheiro\s*:\s*([^\n\r]+)"

    )

    return {

        "declared_transactions":

            declared_transactions,

        "declared_total_amount":

            parse_portuguese_decimal(

                total_amount_text

            )

            if total_amount_text

            else None,

        "collection_date":

            parse_portuguese_date(

                collection_date_text

            ),

        "file_identifier":

            file_identifier,

    }



def extract_pdf_rows(

    contents: bytes,

) -> tuple[

    list[dict],

    str,

]:

    """

    Lê a tabela dos PDFs de retorno bancário.

    A extração é feita página a página e agrupa linhas

    partidas pelo próprio PDF antes de interpretar o registo.

    Isto permite tratar nomes e descrições que ocupam

    mais do que uma linha.

    """

    try:

        reader = PdfReader(

            BytesIO(contents),

        )

    except Exception as exc:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "Não foi possível abrir o ficheiro PDF. "

                "O ficheiro poderá estar corrompido."

            ),

        ) from exc

    rows: list[dict] = []

    all_page_texts: list[str] = []

    for page in reader.pages:

        try:

            page_text = (

                page.extract_text()

                or ""

            )

        except Exception as exc:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "Não foi possível extrair texto "

                    "de uma das páginas do PDF."

                ),

            ) from exc

        all_page_texts.append(

            page_text

        )

        normalized_lines = [

            " ".join(

                line.split()

            )

            for line in page_text.splitlines()

            if line.strip()

        ]

        raw_records: list[str] = []

        current_record: str | None = None

        for line in normalized_lines:

            if PDF_ROW_START_PATTERN.match(

                line

            ):

                if current_record:

                    raw_records.append(

                        current_record

                    )

                current_record = line

                continue

            if current_record is None:

                continue

            # Cabeçalhos e rodapés da tabela não fazem

            # parte da descrição do movimento.

            if (

                line.startswith("Pág.")

                or line.startswith("Referência da")

                or line.startswith("ADC Nome do Devedor")

            ):

                continue

            current_record = (

                f"{current_record} {line}"

            )

        if current_record:

            raw_records.append(

                current_record

            )

        for raw_record in raw_records:

            match = PDF_ROW_PATTERN.match(

                raw_record

            )

            if not match:

                continue

            data = match.groupdict()

            rows.append(

                {

                    "bank_reference":

                        data[

                            "bank_reference"

                        ],

                    "original_member_reference":

                        data[

                            "member_reference"

                        ],

                    "name":

                        data[

                            "name"

                        ].strip(),

                    "iban":

                        data[

                            "iban"

                        ].strip(),

                    "amount":

                        parse_portuguese_decimal(

                            data[

                                "amount"

                            ]

                        ),

                    "reason_code":

                        data[

                            "reason_code"

                        ].strip().upper(),

                    "reason_description":

                        data[

                            "reason_description"

                        ].strip(),

                }

            )

    full_text = "\n".join(

        all_page_texts

    )

    return (

        rows,

        full_text,

    )



def process_pdf_calendar_file(

    db: Session,

    *,

    file_id: int,

) -> dict:

    """

    Processa PDFs do tipo:

    "Detalhe do Retorno do Ficheiro de Cobranças".

    O PDF fornece diretamente:

    - Referência da cobrança

    - Referência ADC / Nº Sócio

    - Nome

    - Montante

    - Código de retorno

    - Descrição do código

    Depois é feito o mesmo cruzamento com a Base CEDIS

    que já é usado no processamento XML.

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

    if calendar_file.file_type != "pdf":

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "O ficheiro selecionado não é um PDF."

            ),

        )

    contents = get_calendar_file_contents(

        calendar_file,

    )

    (

        parsed_rows,

        full_text,

    ) = extract_pdf_rows(

        contents,

    )

    if not parsed_rows:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "Não foram encontrados movimentos bancários "

                "no PDF. Confirme se é um relatório de retorno "

                "de cobranças suportado pelo EPIC Payments."

            ),

        )

    metadata = extract_pdf_metadata(

        full_text,

    )

    (

        cedis_lookup,

        cedis_file_id,

        cedis_filename,

    ) = build_active_cedis_lookup(

        db,

    )

    movements: list[dict] = []

    collection_date = (

        metadata[

            "collection_date"

        ]

    )

    for sequence, row in enumerate(

        parsed_rows,

        start=1,

    ):

        original_member_reference = (

            row[

                "original_member_reference"

            ]

        )

        member_number = (

            normalize_member_reference(

                original_member_reference

            )

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

                cedis_member.get(

                    "is_minor"

                )

            )

            if cedis_member

            else False

        )

        reason_code = (

            row[

                "reason_code"

            ]

        )

        pdf_description = (

            row[

                "reason_description"

            ]

            or ""

        ).strip()

        # O PDF é a fonte principal da descrição.

        # Se por algum motivo vier vazia, usamos

        # o nosso dicionário central.

        reason_description = (

            pdf_description

            or get_reason_description(

                reason_code

            )

        )

        movements.append(

            {

                "sequence":

                    sequence,

                "original_member_reference":

                    original_member_reference,

                "member_number":

                    member_number,

                "name":

                    (

                        row["name"]

                        or cedis_name

                        or ""

                    ),

                "iban":

                    row.get("iban"),

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

                    row[

                        "amount"

                    ],

                "reason_code":

                    reason_code,

                "reason_description":

                    reason_description,

                "collection_date":

                    collection_date,

                "bank_reference":

                    row[

                        "bank_reference"

                    ],

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

        # O PDF não tem os mesmos IDs técnicos do XML.

        "message_id":

            metadata[

                "file_identifier"

            ],

        "original_message_id":

            None,

        "declared_transactions":

            metadata[

                "declared_transactions"

            ],

        "declared_total_amount":

            metadata[

                "declared_total_amount"

            ],

        "parsed_transactions":

            len(movements),

        "parsed_total_amount":

            parsed_total_amount,

        "movements":

            movements,

    }





# =========================================================

# PROCESSAMENTO DE RECUPERAÇÃO F1 + F2

# =========================================================



def get_recovery_pair(

    db: Session,

    *,

    calendar_file: CalendarFile,

) -> tuple[CalendarFile, CalendarFile | None]:

    """

    Resolve o par funcional de recuperação.

    Regras:

    - F1: file_category = recovery, recovery_part = 1

    - F2: file_category = recovery, recovery_part = 2

    - F2.related_file_id = F1.id

    É permitido processar F1 sem F2. Nesse caso, os movimentos

    inicialmente aceites (0000) ficam provisórios até o F2

    ser carregado.

    F2 sem F1 válido é considerado inconsistente.

    """

    if calendar_file.file_category != "recovery":

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "O ficheiro selecionado não pertence "

                "à categoria de recuperação."

            ),

        )

    if calendar_file.recovery_part == 1:

        recovery_file_1 = calendar_file

        recovery_file_2 = (

            db.query(CalendarFile)

            .filter(

                CalendarFile.file_category == "recovery",

                CalendarFile.recovery_part == 2,

                CalendarFile.related_file_id

                == recovery_file_1.id,

            )

            .order_by(CalendarFile.id.desc())

            .first()

        )

        if (

            recovery_file_2 is not None

            and recovery_file_2.calendar_date

            != recovery_file_1.calendar_date

        ):

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "O par de recuperação está inconsistente: "

                    "F1 e F2 pertencem a dias diferentes."

                ),

            )

        return (

            recovery_file_1,

            recovery_file_2,

        )

    if calendar_file.recovery_part == 2:

        if calendar_file.related_file_id is None:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "O Ficheiro 2 de recuperação não possui "

                    "ligação ao respetivo Ficheiro 1."

                ),

            )

        recovery_file_1 = get_calendar_file_by_id(

            db,

            calendar_file.related_file_id,

        )

        if (

            recovery_file_1 is None

            or recovery_file_1.file_category != "recovery"

            or recovery_file_1.recovery_part != 1

        ):

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "O Ficheiro 1 associado a esta recuperação "

                    "não existe ou é inválido."

                ),

            )

        if (

            recovery_file_1.calendar_date

            != calendar_file.calendar_date

        ):

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "O par de recuperação está inconsistente: "

                    "F1 e F2 pertencem a dias diferentes."

                ),

            )

        return (

            recovery_file_1,

            calendar_file,

        )

    raise HTTPException(

        status_code=status.HTTP_400_BAD_REQUEST,

        detail=(

            "O ficheiro de recuperação não indica "

            "corretamente se é Ficheiro 1 ou Ficheiro 2."

        ),

    )



def build_unique_movements_by_bank_reference(

    movements: list[dict],

    *,

    filename: str,

) -> dict[str, dict]:

    """

    Cria um índice pela Referência da Cobrança.

    A Referência da Cobrança é a chave prioritária do

    processamento de recuperação. Não é permitido resolver

    ambiguidades usando nº de sócio, nome ou valor.

    """

    lookup: dict[str, dict] = {}

    for movement in movements:

        bank_reference = str(

            movement.get("bank_reference")

            or ""

        ).strip()

        if not bank_reference:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "Foi encontrado um movimento sem "

                    "Referência da Cobrança no ficheiro "

                    f"{filename}."

                ),

            )

        if bank_reference in lookup:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=(

                    "Foi encontrada uma Referência da Cobrança "

                    f"duplicada ({bank_reference}) no ficheiro "

                    f"{filename}. O EPIC Payments não irá "

                    "fundir movimentos de forma automática."

                ),

            )

        lookup[bank_reference] = movement

    return lookup



def process_recovery_consolidation(

    db: Session,

    *,

    file_id: int,

) -> dict:

    """

    Consolida uma recuperação como um único conjunto F1 + F2.

    Regra por Referência da Cobrança:

    1) F1 diferente de 0000:

       -> NÃO PAGA

       -> mantém o motivo original do F1

    2) F1 = 0000 e ainda não existe F2:

       -> PROVISÓRIO

       -> "Ficheiro 2 ainda não carregado"

    3) F1 = 0000 e a mesma referência NÃO aparece no F2:

       -> RECUPERADA COM SUCESSO

    4) F1 = 0000 e a mesma referência aparece no F2:

       -> NÃO PAGA

       -> usa código/motivo do F2

    Nunca cruza movimentos apenas pelo nº de sócio.

    """

    selected_file = get_calendar_file_by_id(

        db,

        file_id,

    )

    if selected_file is None:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail="Ficheiro não encontrado.",

        )

    (

        recovery_file_1,

        recovery_file_2,

    ) = get_recovery_pair(

        db,

        calendar_file=selected_file,

    )

    # Os ficheiros físicos de recuperação são PDFs,

    # mas funcionalmente formam uma categoria própria.

    if recovery_file_1.file_type != "pdf":

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "O Ficheiro 1 de recuperação não é um PDF."

            ),

        )

    if (

        recovery_file_2 is not None

        and recovery_file_2.file_type != "pdf"

    ):

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "O Ficheiro 2 de recuperação não é um PDF."

            ),

        )

    result_f1 = process_pdf_calendar_file(

        db,

        file_id=recovery_file_1.id,

    )

    movements_f1 = result_f1[

        "movements"

    ]

    # Validamos também F1 para impedir que uma referência

    # ambígua seja consolidada silenciosamente.

    build_unique_movements_by_bank_reference(

        movements_f1,

        filename=recovery_file_1.original_filename,

    )

    result_f2: dict | None = None

    movements_f2_by_reference: dict[str, dict] = {}

    if recovery_file_2 is not None:

        result_f2 = process_pdf_calendar_file(

            db,

            file_id=recovery_file_2.id,

        )

        movements_f2_by_reference = (

            build_unique_movements_by_bank_reference(

                result_f2["movements"],

                filename=(

                    recovery_file_2.original_filename

                ),

            )

        )

    consolidated_movements: list[dict] = []

    for movement_f1 in movements_f1:

        bank_reference = str(

            movement_f1.get("bank_reference")

            or ""

        ).strip()

        original_f1_reason_code = str(

            movement_f1.get("reason_code")

            or ""

        ).strip().upper()

        movement_f2 = (

            movements_f2_by_reference.get(

                bank_reference

            )

            if recovery_file_2 is not None

            else None

        )

        consolidated = dict(

            movement_f1

        )

        consolidated.update(

            {

                "recovery_file_1_id":

                    recovery_file_1.id,

                "recovery_file_2_id":

                    (

                        recovery_file_2.id

                        if recovery_file_2

                        else None

                    ),

                "recovery_f1_reason_code":

                    original_f1_reason_code,

                "recovery_f1_reason_description":

                    movement_f1.get(

                        "reason_description"

                    ),

                "recovery_f2_reason_code":

                    (

                        movement_f2.get(

                            "reason_code"

                        )

                        if movement_f2

                        else None

                    ),

                "recovery_f2_reason_description":

                    (

                        movement_f2.get(

                            "reason_description"

                        )

                        if movement_f2

                        else None

                    ),

                "recovery_status":

                    None,

                "requires_action":

                    False,

            }

        )

        # F1 rejeitada: já sabemos que não foi recuperada.

        if original_f1_reason_code != "0000":

            consolidated[

                "recovery_status"

            ] = "NAO_PAGA"

            consolidated[

                "requires_action"

            ] = True

        # F1 aceite mas ainda não existe F2.

        elif recovery_file_2 is None:

            consolidated[

                "recovery_status"

            ] = "PROVISORIO"

            consolidated[

                "reason_description"

            ] = (

                "Ficheiro 2 ainda não carregado"

            )

        # F1 aceite e devolvida posteriormente no F2.

        elif movement_f2 is not None:

            final_reason_code = str(

                movement_f2.get(

                    "reason_code"

                )

                or ""

            ).strip().upper()

            consolidated[

                "recovery_status"

            ] = "NAO_PAGA"

            consolidated[

                "requires_action"

            ] = True

            # Colocamos o motivo final nos campos principais

            # para o frontend atual poder filtrar/tratar este

            # movimento sem depender já de novos componentes.

            consolidated[

                "reason_code"

            ] = final_reason_code

            consolidated[

                "reason_description"

            ] = (

                movement_f2.get(

                    "reason_description"

                )

                or get_reason_description(

                    final_reason_code

                )

            )

        # F1 aceite e não aparece no F2.

        else:

            consolidated[

                "recovery_status"

            ] = "RECUPERADA_COM_SUCESSO"

            consolidated[

                "requires_action"

            ] = False

            consolidated[

                "reason_code"

            ] = "0000"

            consolidated[

                "reason_description"

            ] = "Recuperada com sucesso"

        consolidated_movements.append(

            consolidated

        )

    recovered_successfully = sum(

        1

        for movement in consolidated_movements

        if movement["recovery_status"]

        == "RECUPERADA_COM_SUCESSO"

    )

    not_paid = sum(

        1

        for movement in consolidated_movements

        if movement["recovery_status"]

        == "NAO_PAGA"

    )

    provisional = sum(

        1

        for movement in consolidated_movements

        if movement["recovery_status"]

        == "PROVISORIO"

    )

    recovered_successfully_amount = sum(

        (

            movement["amount"]

            for movement in consolidated_movements

            if movement["recovery_status"]

            == "RECUPERADA_COM_SUCESSO"

        ),

        Decimal("0"),

    )

    not_paid_amount = sum(

        (

            movement["amount"]

            for movement in consolidated_movements

            if movement["recovery_status"]

            == "NAO_PAGA"

        ),

        Decimal("0"),

    )

    provisional_amount = sum(

        (

            movement["amount"]

            for movement in consolidated_movements

            if movement["recovery_status"]

            == "PROVISORIO"

        ),

        Decimal("0"),

    )

    cedis_matches = sum(

        1

        for movement in consolidated_movements

        if movement["cedis_match"]

    )

    cedis_unmatched = (

        len(consolidated_movements)

        - cedis_matches

    )

    minor_members = sum(

        1

        for movement in consolidated_movements

        if movement["is_minor"]

    )

    return {

        "file_id":

            recovery_file_1.id,

        "filename":

            recovery_file_1.original_filename,

        "file_type":

            "pdf",

        "file_category":

            "recovery",

        "recovery_part":

            1,

        "recovery_file_1_id":

            recovery_file_1.id,

        "recovery_file_1_filename":

            recovery_file_1.original_filename,

        "recovery_file_2_id":

            (

                recovery_file_2.id

                if recovery_file_2

                else None

            ),

        "recovery_file_2_filename":

            (

                recovery_file_2.original_filename

                if recovery_file_2

                else None

            ),

        "recovery_pair_complete":

            recovery_file_2 is not None,

        "recovery_result_status":

            (

                "FINAL"

                if recovery_file_2 is not None

                else "PROVISORIO"

            ),

        "cedis_file_id":

            result_f1.get(

                "cedis_file_id"

            ),

        "cedis_filename":

            result_f1.get(

                "cedis_filename"

            ),

        "cedis_matches":

            cedis_matches,

        "cedis_unmatched":

            cedis_unmatched,

        "minor_members":

            minor_members,

        "message_id":

            result_f1.get(

                "message_id"

            ),

        "original_message_id":

            None,

        "declared_transactions":

            result_f1.get(

                "declared_transactions"

            ),

        "declared_total_amount":

            result_f1.get(

                "declared_total_amount"

            ),

        "parsed_transactions":

            len(consolidated_movements),

        "parsed_total_amount":

            sum(

                (

                    movement["amount"]

                    for movement

                    in consolidated_movements

                ),

                Decimal("0"),

            ),

        "recovered_successfully":

            recovered_successfully,

        "recovered_successfully_amount":

            recovered_successfully_amount,

        "not_paid":

            not_paid,

        "not_paid_amount":

            not_paid_amount,

        "provisional":

            provisional,

        "provisional_amount":

            provisional_amount,

        "recovery_f2_transactions":

            (

                result_f2.get(

                    "parsed_transactions"

                )

                if result_f2

                else 0

            ),

        "recovery_f2_total_amount":

            (

                result_f2.get(

                    "parsed_total_amount"

                )

                if result_f2

                else Decimal("0")

            ),

        "movements":

            consolidated_movements,

    }





def process_recovery_source_file(

    db: Session,

    *,

    file_id: int,

) -> dict:

    """

    Lê UM ficheiro de recuperação sem conciliar F1 com F2.

    Esta é a visualização inicial do processamento de Recuperação:

    - F1 mostra apenas o conteúdo original de F1;

    - F2 mostra apenas o conteúdo original de F2;

    - não determina ainda PAGO / NÃO PAGO;

    - não apresenta dados enriquecidos da Base CEDIS.

    A conciliação F1 x F2 fica reservada para a etapa

    "Realizar filtragem".

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

    if calendar_file.file_category != "recovery":

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "O ficheiro selecionado não pertence "

                "à categoria de recuperação."

            ),

        )

    if calendar_file.recovery_part not in {1, 2}:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=(

                "O ficheiro de recuperação não indica "

                "corretamente se é Ficheiro 1 ou Ficheiro 2."

            ),

        )

    if calendar_file.file_type != "pdf":

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="O ficheiro de recuperação não é um PDF.",

        )

    result = process_pdf_calendar_file(

        db,

        file_id=file_id,

    )

    # A primeira leitura da recuperação deve reproduzir apenas

    # o conteúdo bancário do próprio PDF. A Base CEDIS só entra

    # na etapa posterior "Filtrar e inserir informações".

    source_movements: list[dict] = []

    for movement in result["movements"]:

        source_movement = dict(movement)

        source_movement.update(

            {

                "cedis_name": None,

                "phone": None,

                "email": None,

                "birth_year": None,

                "age": None,

                "is_minor": False,

                "cedis_match": False,

            }

        )

        source_movements.append(

            source_movement

        )

    result.update(

        {

            "file_category": "recovery",

            "recovery_part": calendar_file.recovery_part,

            "related_file_id": calendar_file.related_file_id,

            "recovery_stage": "SOURCE",

            "cedis_file_id": None,

            "cedis_filename": None,

            "cedis_matches": 0,

            "cedis_unmatched": 0,

            "minor_members": 0,

            "movements": source_movements,

        }

    )

    return result





def process_calendar_file(

    db: Session,

    *,

    file_id: int,

) -> dict:

    """

    Dispatcher único do processamento bancário.

    Recuperação -> process_recovery_source_file (leitura original)

    XML         -> process_xml_calendar_file

    PDF         -> process_pdf_calendar_file

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

    # IMPORTANTE:

    # Recuperação é uma categoria funcional própria.

    # Apesar de F1/F2 serem PDFs físicos, nunca devem

    # passar diretamente pelo fluxo de PDF bancário normal.

    if calendar_file.file_category == "recovery":

        return process_recovery_source_file(

            db,

            file_id=file_id,

        )

    if calendar_file.file_type == "xml":

        return process_xml_calendar_file(

            db,

            file_id=file_id,

        )

    if calendar_file.file_type == "pdf":

        return process_pdf_calendar_file(

            db,

            file_id=file_id,

        )

    raise HTTPException(

        status_code=status.HTTP_400_BAD_REQUEST,

        detail=(

            "Este formato de ficheiro ainda não "

            "pode ser processado."

        ),

    )