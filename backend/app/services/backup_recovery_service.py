from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.services.r2_storage import (
    get_r2_client,
)


BACKUP_PREFIX = "backups/neon/daily/"

BACKUP_RETENTION_DAYS = 30
BACKUP_SCHEDULE_UTC = "03:00"
NEON_HISTORY_HOURS = 6

HEALTHY_MAX_AGE_HOURS = 36
WARNING_MAX_AGE_HOURS = 48


def _utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def _ensure_utc(
    value: datetime,
) -> datetime:
    if value.tzinfo is None:
        return value.replace(
            tzinfo=timezone.utc
        )

    return value.astimezone(
        timezone.utc
    )


def _get_bucket_name() -> str:
    bucket_name = (
        settings.r2_bucket_name
        or ""
    ).strip()

    if not bucket_name:
        raise RuntimeError(
            "R2_BUCKET_NAME não está configurado."
        )

    return bucket_name


def _calculate_age_hours(
    last_modified: datetime,
) -> float:
    modified_at = _ensure_utc(
        last_modified
    )

    difference = (
        _utc_now()
        - modified_at
    )

    age_hours = (
        difference.total_seconds()
        / 3600
    )

    return max(
        0.0,
        age_hours,
    )


def _get_status(
    *,
    backup_count: int,
    age_hours: float | None,
) -> tuple[str, str]:
    if (
        backup_count <= 0
        or age_hours is None
    ):
        return (
            "missing",
            "Sem backup",
        )

    if (
        age_hours
        <= HEALTHY_MAX_AGE_HOURS
    ):
        return (
            "protected",
            "Protegido",
        )

    if (
        age_hours
        <= WARNING_MAX_AGE_HOURS
    ):
        return (
            "warning",
            "Atenção",
        )

    return (
        "overdue",
        "Backup atrasado",
    )


def _list_backup_objects() -> list[dict[str, Any]]:
    client = get_r2_client()

    bucket_name = (
        _get_bucket_name()
    )

    backups: list[
        dict[str, Any]
    ] = []

    continuation_token: (
        str | None
    ) = None

    while True:
        parameters: dict[
            str,
            Any,
        ] = {
            "Bucket": bucket_name,
            "Prefix": BACKUP_PREFIX,
            "MaxKeys": 1000,
        }

        if continuation_token:
            parameters[
                "ContinuationToken"
            ] = continuation_token

        response = (
            client.list_objects_v2(
                **parameters
            )
        )

        for item in response.get(
            "Contents",
            [],
        ):
            key = str(
                item.get(
                    "Key",
                    "",
                )
            )

            if (
                not key
                or not key.endswith(
                    ".dump"
                )
            ):
                continue

            last_modified = (
                item.get(
                    "LastModified"
                )
            )

            if not isinstance(
                last_modified,
                datetime,
            ):
                continue

            backups.append(
                {
                    "object_key": key,
                    "size_bytes": int(
                        item.get(
                            "Size",
                            0,
                        )
                        or 0
                    ),
                    "last_modified": (
                        _ensure_utc(
                            last_modified
                        )
                    ),
                    "etag": str(
                        item.get(
                            "ETag",
                            "",
                        )
                    ).strip('"'),
                }
            )

        if not response.get(
            "IsTruncated"
        ):
            break

        continuation_token = (
            response.get(
                "NextContinuationToken"
            )
        )

        if not continuation_token:
            break

    backups.sort(
        key=lambda item: (
            item["last_modified"]
        ),
        reverse=True,
    )

    return backups


def get_backup_recovery_status() -> dict:
    checked_at = _utc_now()

    try:
        backups = (
            _list_backup_objects()
        )

        backup_count = len(
            backups
        )

        latest_backup = (
            backups[0]
            if backups
            else None
        )

        if latest_backup:
            age_hours = (
                _calculate_age_hours(
                    latest_backup[
                        "last_modified"
                    ]
                )
            )
        else:
            age_hours = None

        (
            status,
            status_label,
        ) = _get_status(
            backup_count=backup_count,
            age_hours=age_hours,
        )

        latest_backup_data = None

        if latest_backup:
            latest_backup_data = {
                "object_key": (
                    latest_backup[
                        "object_key"
                    ]
                ),
                "filename": (
                    latest_backup[
                        "object_key"
                    ]
                    .rsplit(
                        "/",
                        1,
                    )[-1]
                ),
                "size_bytes": (
                    latest_backup[
                        "size_bytes"
                    ]
                ),
                "last_modified": (
                    latest_backup[
                        "last_modified"
                    ]
                    .isoformat()
                ),
                "age_hours": round(
                    age_hours
                    or 0.0,
                    2,
                ),
                "etag": (
                    latest_backup[
                        "etag"
                    ]
                ),
            }

        return {
            "status": status,
            "status_label": (
                status_label
            ),
            "checked_at": (
                checked_at
                .isoformat()
            ),
            "backup": {
                "enabled": True,
                "provider": (
                    "GitHub Actions"
                ),
                "schedule_utc": (
                    BACKUP_SCHEDULE_UTC
                ),
                "prefix": (
                    BACKUP_PREFIX
                ),
                "retention_days": (
                    BACKUP_RETENTION_DAYS
                ),
                "validation": (
                    "pg_restore --list"
                ),
                "format": (
                    "PostgreSQL Custom"
                ),
                "backup_count": (
                    backup_count
                ),
                "latest": (
                    latest_backup_data
                ),
            },
            "neon": {
                "instant_restore": True,
                "history_hours": (
                    NEON_HISTORY_HOURS
                ),
            },
            "thresholds": {
                "protected_max_age_hours": (
                    HEALTHY_MAX_AGE_HOURS
                ),
                "warning_max_age_hours": (
                    WARNING_MAX_AGE_HOURS
                ),
            },
        }

    except Exception as exc:
        return {
            "status": "error",
            "status_label": (
                "Erro de verificação"
            ),
            "checked_at": (
                checked_at
                .isoformat()
            ),
            "error": str(exc),
            "backup": {
                "enabled": True,
                "provider": (
                    "GitHub Actions"
                ),
                "schedule_utc": (
                    BACKUP_SCHEDULE_UTC
                ),
                "prefix": (
                    BACKUP_PREFIX
                ),
                "retention_days": (
                    BACKUP_RETENTION_DAYS
                ),
                "validation": (
                    "pg_restore --list"
                ),
                "format": (
                    "PostgreSQL Custom"
                ),
                "backup_count": 0,
                "latest": None,
            },
            "neon": {
                "instant_restore": True,
                "history_hours": (
                    NEON_HISTORY_HOURS
                ),
            },
            "thresholds": {
                "protected_max_age_hours": (
                    HEALTHY_MAX_AGE_HOURS
                ),
                "warning_max_age_hours": (
                    WARNING_MAX_AGE_HOURS
                ),
            },
        }