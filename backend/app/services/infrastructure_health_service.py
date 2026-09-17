from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Callable

from sqlalchemy import text

from app.database.session import SessionLocal
from app.services.d1_service import get_d1_rows
from app.services.r2_storage import (
    R2_BUCKET_NAME,
    get_r2_client,
)


def _measure_check(
    check: Callable[[], None],
) -> dict[str, Any]:
    started_at = perf_counter()

    try:
        check()

        elapsed_ms = (
            perf_counter()
            - started_at
        ) * 1000

        return {
            "status": "online",
            "latency_ms": round(
                elapsed_ms,
                2,
            ),
        }

    except Exception as exc:
        elapsed_ms = (
            perf_counter()
            - started_at
        ) * 1000

        return {
            "status": "offline",
            "latency_ms": round(
                elapsed_ms,
                2,
            ),
            "error_type": type(
                exc
            ).__name__,
        }


def _check_neon() -> None:
    db = SessionLocal()

    try:
        result = db.execute(
            text(
                "SELECT 1"
            )
        )

        value = result.scalar()

        if value != 1:
            raise RuntimeError(
                "Resposta inesperada do PostgreSQL."
            )

    finally:
        db.close()


def _check_d1() -> None:
    rows = get_d1_rows(
        "SELECT 1 AS ok"
    )

    if not rows:
        raise RuntimeError(
            "O D1 não devolveu resposta."
        )

    value = rows[0].get(
        "ok"
    )

    if value != 1:
        raise RuntimeError(
            "Resposta inesperada do D1."
        )


def _check_r2() -> None:
    client = get_r2_client()

    client.list_objects_v2(
        Bucket=R2_BUCKET_NAME,
        MaxKeys=1,
    )


def get_infrastructure_health() -> dict[str, Any]:
    services = {
        "backend": {
            "status": "online",
            "latency_ms": 0.0,
        },
        "neon": _measure_check(
            _check_neon
        ),
        "cloudflare_d1": _measure_check(
            _check_d1
        ),
        "cloudflare_r2": _measure_check(
            _check_r2
        ),
    }

    all_online = all(
        service.get(
            "status"
        ) == "online"
        for service in services.values()
    )

    return {
        "status": (
            "healthy"
            if all_online
            else "degraded"
        ),
        "checked_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "services": services,
    }