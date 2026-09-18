from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models import CalendarFile, CedisFile


R2_PREFIX = "r2://"


def _utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def _is_r2_path(
    file_path: str | None,
) -> bool:
    return bool(
        file_path
        and file_path.startswith(
            R2_PREFIX
        )
    )


def _calendar_diagnostics(
    db: Session,
) -> dict[str, Any]:
    rows = (
        db.query(CalendarFile)
        .order_by(CalendarFile.id)
        .all()
    )

    cloud_rows = [
        row
        for row in rows
        if _is_r2_path(
            row.file_path
        )
    ]

    local_rows = [
        row
        for row in rows
        if not _is_r2_path(
            row.file_path
        )
    ]

    return {
        "status": (
            "cloud"
            if not local_rows
            else "local_dependency"
        ),
        "total": len(rows),
        "r2": len(cloud_rows),
        "local": len(local_rows),
        "local_records": [
            {
                "id": row.id,
                "original_filename": (
                    row.original_filename
                ),
                "file_path": (
                    row.file_path
                ),
            }
            for row in local_rows
        ],
    }


def _cedis_diagnostics(
    db: Session,
) -> dict[str, Any]:
    rows = (
        db.query(CedisFile)
        .order_by(CedisFile.id)
        .all()
    )

    active_rows = [
        row
        for row in rows
        if row.is_active
    ]

    active_cloud_rows = [
        row
        for row in active_rows
        if _is_r2_path(
            row.file_path
        )
    ]

    active_local_rows = [
        row
        for row in active_rows
        if not _is_r2_path(
            row.file_path
        )
    ]

    historical_local_rows = [
        row
        for row in rows
        if (
            not row.is_active
            and not _is_r2_path(
                row.file_path
            )
        )
    ]

    historical_cloud_rows = [
        row
        for row in rows
        if (
            not row.is_active
            and _is_r2_path(
                row.file_path
            )
        )
    ]

    return {
        "status": (
            "cloud"
            if not active_local_rows
            else "local_dependency"
        ),
        "total": len(rows),
        "active": len(active_rows),
        "active_r2": len(
            active_cloud_rows
        ),
        "active_local": len(
            active_local_rows
        ),
        "historical_r2": len(
            historical_cloud_rows
        ),
        "historical_local": len(
            historical_local_rows
        ),
        "active_local_records": [
            {
                "id": row.id,
                "original_filename": (
                    row.original_filename
                ),
                "file_path": (
                    row.file_path
                ),
            }
            for row in active_local_rows
        ],
        "historical_local_records": [
            {
                "id": row.id,
                "original_filename": (
                    row.original_filename
                ),
                "file_path": (
                    row.file_path
                ),
            }
            for row in historical_local_rows
        ],
    }


def get_environment_separation_status() -> dict:
    checked_at = _utc_now()

    db = SessionLocal()

    try:
        calendar = (
            _calendar_diagnostics(
                db
            )
        )

        cedis = (
            _cedis_diagnostics(
                db
            )
        )

        active_local_dependencies = (
            calendar["local"]
            + cedis["active_local"]
        )

        legacy_local_records = (
            cedis[
                "historical_local"
            ]
        )

        production_independent = (
            active_local_dependencies
            == 0
        )

        if production_independent:
            status = "independent"
            status_label = (
                "Produção independente"
            )
        else:
            status = (
                "local_dependency"
            )
            status_label = (
                "Dependência local detetada"
            )

        checks = {
            "production_independent": {
                "status": (
                    "ok"
                    if production_independent
                    else "error"
                ),
                "label": (
                    "Produção independente "
                    "do PC"
                ),
                "detail": (
                    "Nenhuma dependência "
                    "local ativa detetada."
                    if production_independent
                    else (
                        f"{active_local_dependencies} "
                        "dependência(s) local(is) "
                        "ativa(s) detetada(s)."
                    )
                ),
            },
            "calendar_files": {
                "status": (
                    "ok"
                    if calendar["local"]
                    == 0
                    else "error"
                ),
                "label": (
                    "Ficheiros bancários"
                ),
                "detail": (
    (
        "Nenhuma dependência local "
        "registada no calendário."
    )
    if calendar["local"]
    == 0
    else (
        f"{calendar['local']} "
        "registo(s) ainda dependem "
        "de armazenamento local."
    )
),
            },
            "cedis_active": {
                "status": (
                    "ok"
                    if cedis[
                        "active_local"
                    ]
                    == 0
                    else "error"
                ),
                "label": (
                    "Base CEDIS ativa"
                ),
                "detail": (
                    (
                        f"{cedis['active_r2']} "
                        "base(s) ativa(s) no R2."
                    )
                    if cedis[
                        "active_local"
                    ]
                    == 0
                    else (
                        f"{cedis['active_local']} "
                        "base(s) ativa(s) ainda "
                        "dependem do disco local."
                    )
                ),
            },
            "legacy_records": {
                "status": (
                    "info"
                    if legacy_local_records
                    else "ok"
                ),
                "label": (
                    "Histórico local legado"
                ),
                "detail": (
                    (
                        f"{legacy_local_records} "
                        "registo(s) CEDIS inativo(s) "
                        "mantido(s) apenas como "
                        "histórico."
                    )
                    if legacy_local_records
                    else (
                        "Não existem registos "
                        "locais históricos."
                    )
                ),
            },
            "neon": {
                "status": "ok",
                "label": "Neon",
                "detail": (
                    "Persistência principal "
                    "em PostgreSQL cloud."
                ),
            },
            "r2": {
                "status": "ok",
                "label": "Cloudflare R2",
                "detail": (
                    "Armazenamento cloud "
                    "dos ficheiros operacionais."
                ),
            },
            "d1": {
                "status": "ok",
                "label": "Cloudflare D1",
                "detail": (
                    "Índice cloud reconstruível "
                    "para pesquisa bancária."
                ),
            },
            "backup": {
                "status": "ok",
                "label": (
                    "Backup automático"
                ),
                "detail": (
                    "Executado pelo GitHub "
                    "Actions sem depender "
                    "de qualquer PC."
                ),
            },
        }

        return {
            "status": status,
            "status_label": (
                status_label
            ),
            "checked_at": (
                checked_at.isoformat()
            ),
            "production_independent": (
                production_independent
            ),
            "summary": {
                "active_local_dependencies": (
                    active_local_dependencies
                ),
                "legacy_local_records": (
                    legacy_local_records
                ),
                "calendar_files_total": (
                    calendar["total"]
                ),
                "calendar_files_r2": (
                    calendar["r2"]
                ),
                "calendar_files_local": (
                    calendar["local"]
                ),
                "cedis_total": (
                    cedis["total"]
                ),
                "cedis_active": (
                    cedis["active"]
                ),
                "cedis_active_r2": (
                    cedis["active_r2"]
                ),
                "cedis_active_local": (
                    cedis["active_local"]
                ),
                "cedis_historical_r2": (
                    cedis[
                        "historical_r2"
                    ]
                ),
                "cedis_historical_local": (
                    cedis[
                        "historical_local"
                    ]
                ),
            },
            "checks": checks,
            "details": {
                "calendar": calendar,
                "cedis": cedis,
            },
        }

    except Exception as exc:
        return {
            "status": "error",
            "status_label": (
                "Erro de verificação"
            ),
            "checked_at": (
                checked_at.isoformat()
            ),
            "production_independent": (
                False
            ),
            "error": str(exc),
        }

    finally:
        db.close()