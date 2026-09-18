from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from app.core.config import settings
from app.database.session import SessionLocal


class StorageUsageError(Exception):
    pass


def get_neon_storage_usage() -> dict[str, Any]:
    db = SessionLocal()

    try:
        database_row = db.execute(
            text(
                """
                SELECT
                    current_database() AS database_name,
                    pg_database_size(
                        current_database()
                    ) AS database_size_bytes
                """
            )
        ).mappings().one()

        totals_row = db.execute(
            text(
                """
                SELECT
                    COALESCE(
                        SUM(
                            pg_relation_size(relid)
                        ),
                        0
                    ) AS tables_size_bytes,
                    COALESCE(
                        SUM(
                            pg_indexes_size(relid)
                        ),
                        0
                    ) AS indexes_size_bytes,
                    COALESCE(
                        SUM(
                            pg_total_relation_size(relid)
                        ),
                        0
                    ) AS user_data_size_bytes
                FROM pg_catalog.pg_statio_user_tables
                """
            )
        ).mappings().one()

        table_rows = db.execute(
            text(
                """
                SELECT
                    schemaname AS schema_name,
                    relname AS table_name,
                    pg_relation_size(
                        relid
                    ) AS table_size_bytes,
                    pg_indexes_size(
                        relid
                    ) AS indexes_size_bytes,
                    pg_total_relation_size(
                        relid
                    ) AS total_size_bytes
                FROM pg_catalog.pg_statio_user_tables
                ORDER BY
                    pg_total_relation_size(
                        relid
                    ) DESC
                LIMIT 10
                """
            )
        ).mappings().all()

        database_size_bytes = int(
            database_row[
                "database_size_bytes"
            ]
            or 0
        )

        storage_limit_bytes = max(
            int(
                settings.neon_storage_limit_bytes
            ),
            0,
        )

        storage_remaining_bytes = max(
            storage_limit_bytes
            - database_size_bytes,
            0,
        )

        if storage_limit_bytes > 0:
            storage_used_percent = (
                database_size_bytes
                / storage_limit_bytes
            ) * 100
        else:
            storage_used_percent = 0.0

        return {
            "status": "online",
            "measured_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "database_name": (
                database_row[
                    "database_name"
                ]
            ),
            "database_size_bytes": (
                database_size_bytes
            ),
            "storage_limit_bytes": (
                storage_limit_bytes
            ),
            "storage_remaining_bytes": (
                storage_remaining_bytes
            ),
            "storage_used_percent": round(
                storage_used_percent,
                4,
            ),
            "tables_size_bytes": int(
                totals_row[
                    "tables_size_bytes"
                ]
                or 0
            ),
            "indexes_size_bytes": int(
                totals_row[
                    "indexes_size_bytes"
                ]
                or 0
            ),
            "user_data_size_bytes": int(
                totals_row[
                    "user_data_size_bytes"
                ]
                or 0
            ),
            "largest_tables": [
                {
                    "schema_name": row[
                        "schema_name"
                    ],
                    "table_name": row[
                        "table_name"
                    ],
                    "table_size_bytes": int(
                        row[
                            "table_size_bytes"
                        ]
                        or 0
                    ),
                    "indexes_size_bytes": int(
                        row[
                            "indexes_size_bytes"
                        ]
                        or 0
                    ),
                    "total_size_bytes": int(
                        row[
                            "total_size_bytes"
                        ]
                        or 0
                    ),
                }
                for row in table_rows
            ],
        }

    except Exception as exc:
        raise StorageUsageError(
            "Não foi possível obter a utilização "
            "de armazenamento do Neon."
        ) from exc

    finally:
        db.close()