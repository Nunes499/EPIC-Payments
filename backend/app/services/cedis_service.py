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


# =========================================================
# CONFIGURAÇÃO
# =========================================================

ALLOWED_EXTENSIONS = {
    ".xls",
    ".xlsx",
}

MAX_FILE_SIZE = 25 * 1024 * 1024

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
# CAMINHOS
# =========================================================

def resolve_cedis_file_path(
    cedis_file: CedisFile,
) -> Path:
    """
    Converte o caminho guardado na base de dados
    num caminho absoluto no servidor.
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
    Devolve o caminho físico do ficheiro CEDIS.

    Gera 404 caso o ficheiro já não exista
    no armazenamento do servidor.
    """

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
    Procura uma versão da Base CEDIS
    através do ID.
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
# LEITURA DO EXCEL
# =========================================================

def read_cedis_excel(
    file_path: Path,
) -> pd.DataFrame:
    """
    Lê ficheiros CEDIS XLS ou XLSX.
    """

    extension = file_path.suffix.lower()

    try:
        if extension == ".xls":
            dataframe = pd.read_excel(
                file_path,
                engine="xlrd",
            )

        elif extension == ".xlsx":
            dataframe = pd.read_excel(
                file_path,
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


def load_cedis_dataframe(
    cedis_file: CedisFile,
) -> pd.DataFrame:
    """
    Carrega uma Base CEDIS já guardada
    no servidor.
    """

    file_path = get_existing_cedis_file_path(
        cedis_file
    )

    return read_cedis_excel(
        file_path
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
    Valida e guarda uma nova versão da Base CEDIS.

    A versão anterior apenas é desativada depois
    de a nova versão ter sido validada e guardada.
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

        CEDIS_STORAGE_ROOT.mkdir(
            parents=True,
            exist_ok=True,
        )

        stored_filename = (
            f"{uuid4().hex}{extension}"
        )

        absolute_file_path = (
            CEDIS_STORAGE_ROOT
            / stored_filename
        )

        absolute_file_path.write_bytes(
            contents
        )

        try:
            # Primeiro validamos fisicamente o Excel.
            dataframe = read_cedis_excel(
                absolute_file_path
            )

            validate_cedis_dataframe(
                dataframe
            )

            relative_file_path = (
                absolute_file_path.relative_to(
                    STORAGE_ROOT.parent
                )
            )

            cedis_file = create_cedis_file(
                db,
                original_filename=upload.filename,
                stored_filename=stored_filename,
                mime_type=upload.content_type,
                file_size=len(contents),
                file_path=str(relative_file_path),
                uploaded_by_id=uploaded_by_id,
            )

            return cedis_file

        except Exception:
            # Se a nova base falhar na validação
            # ou no registo na BD, removemos apenas
            # o novo ficheiro físico.
            if absolute_file_path.exists():
                absolute_file_path.unlink()

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