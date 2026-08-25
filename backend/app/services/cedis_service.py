from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.crud.cedis_file import (
    create_cedis_file,
    get_cedis_file_by_id,
)
from app.models.cedis_file import CedisFile
from app.services.r2_storage import (
    delete_object_from_r2,
    download_bytes_from_r2,
    upload_bytes_to_r2,
)


# =========================================================
# CONFIGURAÇÃO
# =========================================================

ALLOWED_EXTENSIONS = {
    ".xls",
    ".xlsx",
}

MAX_FILE_SIZE = 25 * 1024 * 1024

# Mantidos apenas para compatibilidade com Bases CEDIS
# antigas que tenham sido guardadas no disco local.
STORAGE_ROOT = Path("storage")
CEDIS_STORAGE_ROOT = STORAGE_ROOT / "cedis"


# =========================================================
# LIMPEZA DOS DADOS
# =========================================================

def clean_cell_value(value) -> str:
    """
    Converte um valor vindo do Excel para texto limpo.

    Evita devolver:
    - NaN
    - None
    - valores com espaços desnecessários
    """

    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass

    if isinstance(value, float) and value.is_integer():
        return str(int(value))

    return str(value).strip()


def clean_integer_value(value) -> int | None:
    """
    Converte valores do Excel para inteiro quando possível.

    Exemplos:
        18      -> 18
        18.0    -> 18
        "18"    -> 18
        NaN     -> None
        ""      -> None
    """

    cleaned = clean_cell_value(value)

    if not cleaned:
        return None

    cleaned = cleaned.replace(",", ".")

    try:
        return int(float(cleaned))
    except (TypeError, ValueError):
        return None


# =========================================================
# R2
# =========================================================

def build_cedis_r2_object_key(
    *,
    stored_filename: str,
) -> str:
    """
    Cria a chave privada da Base CEDIS no Cloudflare R2.

    Exemplo:
        cedis/abc123.xlsx
    """

    return f"cedis/{stored_filename}"


def build_r2_file_path(
    object_key: str,
) -> str:
    """
    Valor guardado em cedis_files.file_path.

    Permite distinguir Bases CEDIS guardadas no R2
    de versões antigas guardadas localmente.
    """

    return f"r2://{object_key}"


def is_r2_file_path(
    file_path: str,
) -> bool:
    return bool(
        file_path
        and file_path.startswith("r2://")
    )


def get_r2_object_key(
    cedis_file: CedisFile,
) -> str:
    file_path = (
        cedis_file.file_path
        or ""
    )

    if not is_r2_file_path(file_path):
        raise ValueError(
            "A Base CEDIS não está armazenada no R2."
        )

    return file_path[len("r2://"):]


# =========================================================
# COMPATIBILIDADE COM FICHEIROS LOCAIS ANTIGOS
# =========================================================

def resolve_cedis_file_path(
    cedis_file: CedisFile,
) -> Path:
    """
    Resolve apenas Bases CEDIS antigas guardadas
    no armazenamento local.
    """

    file_path = Path(
        cedis_file.file_path
    )

    if not file_path.is_absolute():
        file_path = (
            Path.cwd()
            / file_path
        )

    return file_path.resolve()


def get_existing_cedis_file_path(
    cedis_file: CedisFile,
) -> Path:
    """
    Devolve o caminho físico de uma Base CEDIS antiga.

    Bases CEDIS novas devem ser obtidas através
    de get_cedis_file_contents().
    """

    if is_r2_file_path(
        cedis_file.file_path
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta Base CEDIS está armazenada online "
                "no Cloudflare R2 e não possui caminho local."
            ),
        )

    file_path = resolve_cedis_file_path(
        cedis_file
    )

    if (
        not file_path.exists()
        or not file_path.is_file()
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "O ficheiro físico da Base CEDIS "
                "não foi encontrado no servidor."
            ),
        )

    return file_path


def get_existing_cedis_file(
    db: Session,
    *,
    file_id: int,
) -> CedisFile:
    """
    Procura uma versão da Base CEDIS através do ID.
    """

    cedis_file = get_cedis_file_by_id(
        db,
        file_id,
    )

    if cedis_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Base CEDIS não encontrada.",
        )

    return cedis_file


# =========================================================
# CONTEÚDO DA BASE CEDIS
# =========================================================

def get_cedis_file_contents(
    cedis_file: CedisFile,
) -> bytes:
    """
    Obtém o conteúdo da Base CEDIS independentemente
    de estar no Cloudflare R2 ou no armazenamento
    local antigo.
    """

    if is_r2_file_path(
        cedis_file.file_path
    ):
        object_key = get_r2_object_key(
            cedis_file
        )

        return download_bytes_from_r2(
            object_key=object_key,
        )

    file_path = get_existing_cedis_file_path(
        cedis_file
    )

    return file_path.read_bytes()


# =========================================================
# LEITURA DO EXCEL
# =========================================================

def read_cedis_excel_bytes(
    contents: bytes,
    *,
    extension: str,
) -> pd.DataFrame:
    """
    Lê uma Base CEDIS diretamente a partir de bytes.

    Isto permite ler o Excel diretamente do R2
    sem criar ficheiros temporários no servidor.
    """

    extension = extension.lower()

    try:
        buffer = BytesIO(contents)

        if extension == ".xls":
            dataframe = pd.read_excel(
                buffer,
                engine="xlrd",
            )

        elif extension == ".xlsx":
            dataframe = pd.read_excel(
                buffer,
                engine="openpyxl",
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Formato da Base CEDIS não suportado."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Não foi possível ler a Base CEDIS. "
                "Confirme se o ficheiro Excel é válido."
            ),
        ) from exc

    return dataframe


def read_cedis_excel(
    file_path: Path,
) -> pd.DataFrame:
    """
    Compatibilidade com código antigo que ainda possa
    fornecer diretamente um caminho físico.
    """

    try:
        contents = file_path.read_bytes()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "O ficheiro físico da Base CEDIS "
                "não foi encontrado no servidor."
            ),
        ) from exc

    return read_cedis_excel_bytes(
        contents,
        extension=file_path.suffix,
    )


def load_cedis_dataframe(
    cedis_file: CedisFile,
) -> pd.DataFrame:
    """
    Carrega uma Base CEDIS guardada no R2 ou,
    para compatibilidade, no armazenamento local antigo.
    """

    contents = get_cedis_file_contents(
        cedis_file
    )

    extension = Path(
        cedis_file.original_filename
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        extension = Path(
            cedis_file.stored_filename
        ).suffix.lower()

    return read_cedis_excel_bytes(
        contents,
        extension=extension,
    )


# =========================================================
# VALIDAÇÃO DA BASE CEDIS
# =========================================================

def validate_cedis_dataframe(
    dataframe: pd.DataFrame,
) -> None:
    """
    Confirma se o Excel possui as colunas
    necessárias para utilização no EPIC Payments.
    """

    required_columns = {
        "Nº Cartão",
        "Nome",
        "NºTelefone/Telemóvel",
        "Endereço de e-mail",
        "Ano de Nascimento",
        "Idade (Anos)",
    }

    dataframe.columns = [
        clean_cell_value(column)
        for column in dataframe.columns
    ]

    missing_columns = (
        required_columns
        - set(dataframe.columns)
    )

    if missing_columns:
        missing_text = ", ".join(
            sorted(missing_columns)
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A Base CEDIS não contém todas "
                "as colunas obrigatórias. "
                f"Em falta: {missing_text}"
            ),
        )

    if dataframe.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A Base CEDIS não contém registos.",
        )


# =========================================================
# GUARDAR / SUBSTITUIR BASE CEDIS
# =========================================================

async def save_cedis_file(
    db: Session,
    *,
    upload: UploadFile,
    uploaded_by_id: int | None = None,
) -> CedisFile:
    """
    Valida e guarda uma nova versão da Base CEDIS
    diretamente no Cloudflare R2.

    O Excel é validado em memória antes do upload.

    Se o registo na base de dados falhar depois do
    upload para o R2, o objeto é removido para evitar
    ficheiros órfãos.
    """

    if not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    extension = Path(
        upload.filename
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Formato não permitido. "
                "Utilize um ficheiro XLS ou XLSX."
            ),
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
                detail=(
                    "O ficheiro excede o limite "
                    "máximo de 25 MB."
                ),
            )

        # Validamos primeiro o Excel em memória.
        # Assim não enviamos ficheiros inválidos para o R2.
        dataframe = read_cedis_excel_bytes(
            contents,
            extension=extension,
        )

        validate_cedis_dataframe(
            dataframe
        )

        stored_filename = (
            f"{uuid4().hex}{extension}"
        )

        object_key = build_cedis_r2_object_key(
            stored_filename=stored_filename,
        )

        upload_bytes_to_r2(
            object_key=object_key,
            contents=contents,
            content_type=upload.content_type,
        )

        try:
            cedis_file = create_cedis_file(
                db,
                original_filename=upload.filename,
                stored_filename=stored_filename,
                mime_type=upload.content_type,
                file_size=len(contents),
                file_path=build_r2_file_path(
                    object_key
                ),
                uploaded_by_id=uploaded_by_id,
            )

            return cedis_file

        except Exception:
            # Se a gravação na BD falhar depois
            # do upload, removemos o objeto do R2.
            try:
                delete_object_from_r2(
                    object_key=object_key,
                )
            except Exception:
                pass

            raise

    finally:
        await upload.close()


# =========================================================
# PREVIEW
# =========================================================

def build_cedis_preview(
    cedis_file: CedisFile,
    *,
    limit: int = 100,
) -> dict:
    """
    Prepara os dados da Base CEDIS
    para visualização no frontend.
    """

    dataframe = load_cedis_dataframe(
        cedis_file
    )

    validate_cedis_dataframe(
        dataframe
    )

    total_records = len(
        dataframe.index
    )

    preview_dataframe = dataframe.head(
        limit
    )

    records: list[dict] = []

    for _, row in preview_dataframe.iterrows():
        age = clean_integer_value(
            row.get("Idade (Anos)")
        )

        birth_year = clean_integer_value(
            row.get("Ano de Nascimento")
        )

        records.append(
            {
                "member_number":
                    clean_cell_value(
                        row.get("Nº Cartão")
                    ),

                "name":
                    clean_cell_value(
                        row.get("Nome")
                    ),

                "phone":
                    clean_cell_value(
                        row.get(
                            "NºTelefone/Telemóvel"
                        )
                    ),

                "email":
                    clean_cell_value(
                        row.get(
                            "Endereço de e-mail"
                        )
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
        )

    return {
        "file": cedis_file,
        "total_records": total_records,
        "records": records,
    }