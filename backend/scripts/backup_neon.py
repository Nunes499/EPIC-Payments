from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


BACKUP_PREFIX = "backups/neon/daily"


def configure_python_path() -> Path:
    backend_root = (
        Path(__file__)
        .resolve()
        .parents[1]
    )

    backend_root_text = str(
        backend_root
    )

    if backend_root_text not in sys.path:
        sys.path.insert(
            0,
            backend_root_text,
        )

    return backend_root


BACKEND_ROOT = configure_python_path()


from app.core.config import settings
from app.services.r2_storage import (
    upload_bytes_to_r2,
)


def get_database_url() -> str:
    database_url = (
        settings.database_url
        or ""
    ).strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL não está configurada."
        )

    return database_url


def normalize_database_url(
    database_url: str,
) -> str:
    """
    Converte uma DATABASE_URL do SQLAlchemy
    para uma URL aceite pelas ferramentas
    nativas do PostgreSQL.
    """

    normalized = database_url.strip()

    sqlalchemy_prefixes = (
        "postgresql+psycopg://",
        "postgresql+psycopg2://",
        "postgresql+asyncpg://",
    )

    for prefix in sqlalchemy_prefixes:
        if normalized.startswith(
            prefix
        ):
            normalized = (
                "postgresql://"
                + normalized[
                    len(prefix):
                ]
            )
            break

    if normalized.startswith(
        "postgres://"
    ):
        normalized = (
            "postgresql://"
            + normalized[
                len(
                    "postgres://"
                ):
            ]
        )

    parsed = urlsplit(
        normalized
    )

    if parsed.scheme != "postgresql":
        raise RuntimeError(
            "DATABASE_URL utiliza um "
            "protocolo PostgreSQL não suportado."
        )

    if not parsed.hostname:
        raise RuntimeError(
            "DATABASE_URL não contém "
            "um servidor PostgreSQL válido."
        )

    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.query,
            parsed.fragment,
        )
    )


def get_executable(
    name: str,
) -> str:
    executable = shutil.which(
        name
    )

    if not executable:
        raise RuntimeError(
            f"{name} não foi encontrado "
            "no ambiente de backup."
        )

    return executable


def build_backup_name(
    created_at: datetime,
) -> str:
    timestamp = (
        created_at.strftime(
            "%Y-%m-%dT%H%M%SZ"
        )
    )

    return (
        f"epic-payments-"
        f"{timestamp}.dump"
    )


def build_object_key(
    backup_name: str,
) -> str:
    return (
        f"{BACKUP_PREFIX}/"
        f"{backup_name}"
    )


def create_database_dump(
    *,
    database_url: str,
    output_path: Path,
) -> None:
    pg_dump = get_executable(
        "pg_dump"
    )

    pg_database_url = (
        normalize_database_url(
            database_url
        )
    )

    command = [
        pg_dump,
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        str(output_path),
        pg_database_url,
    ]

    result = subprocess.run(
        command,
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        error_message = (
            result.stderr
            or result.stdout
            or "Erro desconhecido."
        ).strip()

        raise RuntimeError(
            "O pg_dump falhou: "
            f"{error_message}"
        )

    if (
        not output_path.exists()
        or not output_path.is_file()
    ):
        raise RuntimeError(
            "O pg_dump terminou sem criar "
            "o ficheiro de backup."
        )

    if (
        output_path
        .stat()
        .st_size
        <= 0
    ):
        raise RuntimeError(
            "O ficheiro de backup criado "
            "está vazio."
        )


def validate_database_dump(
    backup_path: Path,
) -> dict:
    """
    Valida o arquivo antes do upload.

    pg_restore --list não altera qualquer
    base de dados. Apenas lê o TOC do dump.
    """

    pg_restore = get_executable(
        "pg_restore"
    )

    result = subprocess.run(
        [
            pg_restore,
            "--list",
            str(backup_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        error_message = (
            result.stderr
            or result.stdout
            or "Erro desconhecido."
        ).strip()

        raise RuntimeError(
            "O backup foi criado, mas "
            "falhou a validação pg_restore: "
            f"{error_message}"
        )

    listing = result.stdout

    if not listing.strip():
        raise RuntimeError(
            "O pg_restore conseguiu abrir "
            "o backup, mas o arquivo não "
            "contém entradas."
        )

    table_data_count = (
        listing.count(
            " TABLE DATA "
        )
    )

    table_count = (
        listing.count(
            " TABLE "
        )
    )

    if table_count <= 0:
        raise RuntimeError(
            "O backup não contém "
            "definições de tabelas."
        )

    if table_data_count <= 0:
        raise RuntimeError(
            "O backup não contém "
            "entradas TABLE DATA."
        )

    return {
        "valid": True,
        "table_entries": (
            table_count
        ),
        "table_data_entries": (
            table_data_count
        ),
    }


def upload_backup(
    *,
    backup_path: Path,
    object_key: str,
) -> None:
    contents = (
        backup_path.read_bytes()
    )

    if not contents:
        raise RuntimeError(
            "O backup está vazio e "
            "não será enviado para o R2."
        )

    upload_bytes_to_r2(
        object_key=object_key,
        contents=contents,
        content_type=(
            "application/octet-stream"
        ),
    )


def run_backup() -> dict:
    created_at = datetime.now(
        timezone.utc
    )

    database_url = (
        get_database_url()
    )

    backup_name = (
        build_backup_name(
            created_at
        )
    )

    object_key = (
        build_object_key(
            backup_name
        )
    )

    with tempfile.TemporaryDirectory(
        prefix="epic-neon-backup-"
    ) as temporary_directory:
        backup_path = (
            Path(
                temporary_directory
            )
            / backup_name
        )

        print(
            "A criar backup Neon..."
        )

        create_database_dump(
            database_url=database_url,
            output_path=backup_path,
        )

        backup_size_bytes = (
            backup_path
            .stat()
            .st_size
        )

        print(
            "Backup criado:"
            f" {backup_size_bytes} bytes"
        )

        print(
            "A validar backup..."
        )

        validation = (
            validate_database_dump(
                backup_path
            )
        )

        print(
            "Backup válido:"
            f" {validation['table_entries']} "
            "tabelas,"
            f" {validation['table_data_entries']} "
            "entradas de dados"
        )

        print(
            "A enviar backup para R2..."
        )

        upload_backup(
            backup_path=backup_path,
            object_key=object_key,
        )

        print(
            "Backup enviado com sucesso."
        )

        return {
            "status": "success",
            "created_at": (
                created_at.isoformat()
            ),
            "object_key": object_key,
            "size_bytes": (
                backup_size_bytes
            ),
            "validation": validation,
        }


def main() -> int:
    try:
        result = run_backup()

        validation = result[
            "validation"
        ]

        print(
            "Backup concluído:"
        )

        print(
            f"  R2: "
            f"{result['object_key']}"
        )

        print(
            f"  Tamanho: "
            f"{result['size_bytes']} bytes"
        )

        print(
            "  Validação: OK"
        )

        print(
            "  Tabelas:"
            f" {validation['table_entries']}"
        )

        print(
            "  Dados:"
            f" {validation['table_data_entries']}"
        )

        return 0

    except Exception as exc:
        print(
            "BACKUP FAILED:",
            str(exc),
            file=sys.stderr,
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(
        main()
    )