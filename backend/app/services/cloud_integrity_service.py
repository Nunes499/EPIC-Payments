from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.database.session import SessionLocal
from app.models.calendar_file import CalendarFile
from app.models.cedis_file import CedisFile
from app.models.communication_row import CommunicationRow
from app.models.daily_report import DailyReport
from app.services.d1_service import get_d1_rows
from app.services.r2_storage import (
    R2_BUCKET_NAME,
    get_r2_client,
)


def _r2_key(
    file_path: str | None,
) -> str | None:
    value = (
        file_path
        or ""
    ).strip()

    if not value:
        return None

    if value.startswith(
        "r2://"
    ):
        value = value[
            len("r2://"):
        ]

    value = value.strip()

    return value or None


def _object_exists(
    client,
    object_key: str,
) -> bool:
    try:
        client.head_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
        )

        return True

    except Exception as exc:
        response = getattr(
            exc,
            "response",
            {},
        )

        error = (
            response.get(
                "Error",
                {},
            )
            if isinstance(
                response,
                dict,
            )
            else {}
        )

        code = str(
            error.get(
                "Code",
                "",
            )
        )

        if code in {
            "404",
            "NoSuchKey",
            "NotFound",
        }:
            return False

        raise


def _issue(
    *,
    category: str,
    severity: str,
    message: str,
    record_id: int | None = None,
    object_key: str | None = None,
) -> dict[str, Any]:
    return {
        "category": category,
        "severity": severity,
        "message": message,
        "record_id": record_id,
        "object_key": object_key,
    }


def get_cloud_integrity() -> dict[str, Any]:
    db = SessionLocal()
    client = get_r2_client()

    issues: list[
        dict[str, Any]
    ] = []

    checked_keys: set[
        str
    ] = set()

    missing_r2_keys: set[
        str
    ] = set()

    try:
        calendar_files = list(
            db.scalars(
                select(
                    CalendarFile
                )
            ).all()
        )

        cedis_files = list(
            db.scalars(
                select(
                    CedisFile
                )
            ).all()
        )

        daily_reports = list(
            db.scalars(
                select(
                    DailyReport
                )
            ).all()
        )

        communication_rows = list(
            db.scalars(
                select(
                    CommunicationRow
                )
            ).all()
        )

        # =================================================
        # HELPER DE VERIFICAÇÃO R2
        # =================================================

        def check_r2_object(
            *,
            object_key: str,
            category: str,
            record_id: int | None,
            message: str,
        ) -> None:
            if (
                object_key
                in checked_keys
            ):
                if (
                    object_key
                    in missing_r2_keys
                ):
                    issues.append(
                        _issue(
                            category=category,
                            severity="error",
                            message=message,
                            record_id=record_id,
                            object_key=object_key,
                        )
                    )

                return

            checked_keys.add(
                object_key
            )

            exists = (
                _object_exists(
                    client,
                    object_key,
                )
            )

            if exists:
                return

            missing_r2_keys.add(
                object_key
            )

            issues.append(
                _issue(
                    category=category,
                    severity="error",
                    message=message,
                    record_id=record_id,
                    object_key=object_key,
                )
            )

        # =================================================
        # CEDIS -> R2
        # =================================================

        for record in cedis_files:
            file_path = (
                record.file_path
                or ""
            ).strip()

            # Bases antigas locais não fazem
            # parte da auditoria cloud.
            if not file_path.startswith(
                "r2://"
            ):
                continue

            object_key = (
                _r2_key(
                    file_path
                )
            )

            if object_key is None:
                issues.append(
                    _issue(
                        category=(
                            "cedis_files"
                        ),
                        severity="error",
                        message=(
                            "O registo CEDIS possui "
                            "um caminho R2 inválido."
                        ),
                        record_id=record.id,
                    )
                )

                continue

            check_r2_object(
                object_key=object_key,
                category="cedis_files",
                record_id=record.id,
                message=(
                    "A Base CEDIS existe no Neon, "
                    "mas o respetivo ficheiro "
                    "não foi encontrado no R2."
                ),
            )

        # =================================================
        # CALENDAR FILES -> R2
        #
        # Mantemos esta verificação caso existam
        # registos Neon atuais ou históricos.
        #
        # A AUSÊNCIA de calendar_files no Neon
        # não é considerada erro.
        # =================================================

        for record in calendar_files:
            file_path = (
                record.file_path
                or ""
            ).strip()

            if not file_path.startswith(
                "r2://"
            ):
                continue

            object_key = (
                _r2_key(
                    file_path
                )
            )

            if object_key is None:
                issues.append(
                    _issue(
                        category=(
                            "calendar_files"
                        ),
                        severity="error",
                        message=(
                            "O registo de calendário "
                            "possui um caminho R2 inválido."
                        ),
                        record_id=record.id,
                    )
                )

                continue

            check_r2_object(
                object_key=object_key,
                category="calendar_files",
                record_id=record.id,
                message=(
                    "O registo de calendário existe, "
                    "mas o respetivo ficheiro "
                    "não foi encontrado no R2."
                ),
            )

        # =================================================
        # DAILY REPORTS -> R2
        # =================================================

        for record in daily_reports:
            file_path = (
                record.file_path
                or ""
            ).strip()

            if not file_path.startswith(
                "r2://"
            ):
                continue

            object_key = (
                _r2_key(
                    file_path
                )
            )

            if object_key is None:
                issues.append(
                    _issue(
                        category=(
                            "daily_reports"
                        ),
                        severity="error",
                        message=(
                            "O relatório possui "
                            "um caminho R2 inválido."
                        ),
                        record_id=record.id,
                    )
                )

                continue

            check_r2_object(
                object_key=object_key,
                category="daily_reports",
                record_id=record.id,
                message=(
                    "O relatório existe no Neon, "
                    "mas o respetivo ficheiro "
                    "não foi encontrado no R2."
                ),
            )

        # =================================================
        # COMMUNICATION ROWS -> R2
        #
        # source_file_key é a identidade estável
        # do ficheiro bancário.
        #
        # Não exigimos calendar_files no Neon.
        # Confirmamos diretamente no R2.
        # =================================================

        communication_keys: set[
            str
        ] = set()

        for row in communication_rows:
            source_key = (
                row.source_file_key
                or ""
            ).strip()

            object_key = (
                _r2_key(
                    source_key
                )
            )

            if object_key is None:
                issues.append(
                    _issue(
                        category=(
                            "communication_rows"
                        ),
                        severity="warning",
                        message=(
                            "A linha de Comunicação "
                            "não possui uma chave válida "
                            "para o ficheiro de origem."
                        ),
                        record_id=row.id,
                    )
                )

                continue

            communication_keys.add(
                object_key
            )

            check_r2_object(
                object_key=object_key,
                category="communication_rows",
                record_id=row.id,
                message=(
                    "A linha de Comunicação aponta "
                    "para um ficheiro que não foi "
                    "encontrado no R2."
                ),
            )

        # =================================================
        # D1 BANK INDEX
        #
        # O D1 é um índice reconstruível.
        #
        # Nesta auditoria verificamos:
        # - erros de indexação;
        # - quantidade de ficheiros;
        # - quantidade de movimentos.
        #
        # Não consideramos como erro o facto de
        # calendar_files estar vazio no Neon.
        # =================================================

        d1_files = get_d1_rows(
            """
            SELECT
                file_id,
                filename,
                index_error
            FROM bank_index_files
            """
        )

        d1_movements = get_d1_rows(
            """
            SELECT
                COUNT(*) AS total_movements
            FROM bank_index_movements
            """
        )

        d1_index_errors = 0

        for row in d1_files:
            index_error = str(
                row.get(
                    "index_error"
                )
                or ""
            ).strip()

            if not index_error:
                continue

            d1_index_errors += 1

            file_id = (
                int(
                    row[
                        "file_id"
                    ]
                )
                if row.get(
                    "file_id"
                ) is not None
                else None
            )

            issues.append(
                _issue(
                    category=(
                        "d1_bank_index"
                    ),
                    severity="error",
                    message=(
                        "O índice bancário D1 "
                        "registou um erro ao "
                        "processar este ficheiro."
                    ),
                    record_id=file_id,
                )
            )

        d1_total_movements = 0

        if d1_movements:
            d1_total_movements = int(
                d1_movements[0].get(
                    "total_movements"
                )
                or 0
            )

        # =================================================
        # ESTADO FINAL
        # =================================================

        error_count = sum(
            1
            for item in issues
            if item[
                "severity"
            ] == "error"
        )

        warning_count = sum(
            1
            for item in issues
            if item[
                "severity"
            ] == "warning"
        )

        if error_count > 0:
            status = "error"

        elif warning_count > 0:
            status = "warning"

        else:
            status = "healthy"

        return {
            "status": status,
            "checked_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "summary": {
                "errors": error_count,
                "warnings": warning_count,
                "issues": len(
                    issues
                ),
                "checked_r2_objects": len(
                    checked_keys
                ),
                "missing_r2_objects": len(
                    missing_r2_keys
                ),
                "calendar_files_neon": len(
                    calendar_files
                ),
                "cedis_files": len(
                    cedis_files
                ),
                "daily_reports": len(
                    daily_reports
                ),
                "communication_rows": len(
                    communication_rows
                ),
                "communication_source_files": len(
                    communication_keys
                ),
                "d1_indexed_files": len(
                    d1_files
                ),
                "d1_indexed_movements": (
                    d1_total_movements
                ),
                "d1_index_errors": (
                    d1_index_errors
                ),
            },
            "issues": issues,
        }

    finally:
        db.close()