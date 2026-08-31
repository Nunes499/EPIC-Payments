from datetime import datetime, timezone
from typing import Any

import requests

from app.core.config import settings


CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql"


class CloudflareMetricsError(Exception):
    pass


def _headers() -> dict[str, str]:
    token = settings.cloudflare_monitoring_api_token

    if not token:
        raise CloudflareMetricsError(
            "CLOUDFLARE_MONITORING_API_TOKEN não está configurado."
        )

    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _graphql_request(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    try:
        response = requests.post(
            CLOUDFLARE_GRAPHQL_URL,
            headers=_headers(),
            json={
                "query": query,
                "variables": variables,
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise CloudflareMetricsError(
            f"Não foi possível comunicar com a Cloudflare: {exc}"
        ) from exc

    if response.status_code != 200:
        raise CloudflareMetricsError(
            f"Cloudflare respondeu com HTTP {response.status_code}: "
            f"{response.text[:500]}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise CloudflareMetricsError(
            "A Cloudflare devolveu uma resposta inválida."
        ) from exc

    if payload.get("errors"):
        messages = [
            item.get("message", "Erro GraphQL")
            for item in payload["errors"]
        ]
        raise CloudflareMetricsError(" | ".join(messages))

    if "data" not in payload:
        raise CloudflareMetricsError(
            "A resposta da Cloudflare não contém dados."
        )

    return payload["data"]


def get_r2_storage_metrics() -> dict[str, Any]:
    account_id = settings.cloudflare_account_id
    bucket_name = settings.r2_bucket_name

    if not account_id:
        raise CloudflareMetricsError(
            "CLOUDFLARE_ACCOUNT_ID não está configurado."
        )

    if not bucket_name:
        raise CloudflareMetricsError(
            "R2_BUCKET_NAME não está configurado."
        )

    query = """
    query R2Storage(
        $accountTag: string!
        $startDate: Time
        $endDate: Time
        $bucketName: string
    ) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                r2StorageAdaptiveGroups(
                    limit: 1
                    filter: {
                        datetime_geq: $startDate
                        datetime_leq: $endDate
                        bucketName: $bucketName
                    }
                    orderBy: [datetime_DESC]
                ) {
                    max {
                        objectCount
                        uploadCount
                        payloadSize
                        metadataSize
                    }
                    dimensions {
                        datetime
                    }
                }
            }
        }
    }
    """

    now = datetime.now(timezone.utc)
    start = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    data = _graphql_request(
        query,
        {
            "accountTag": account_id,
            "startDate": start.isoformat().replace("+00:00", "Z"),
            "endDate": now.isoformat().replace("+00:00", "Z"),
            "bucketName": bucket_name,
        },
    )

    accounts = data.get("viewer", {}).get("accounts", [])

    if not accounts:
        raise CloudflareMetricsError(
            "A Cloudflare não devolveu dados para esta conta."
        )

    groups = accounts[0].get("r2StorageAdaptiveGroups", [])

    if not groups:
        return {
            "bucket_name": bucket_name,
            "object_count": 0,
            "payload_size_bytes": 0,
            "metadata_size_bytes": 0,
            "upload_count": 0,
            "measured_at": None,
        }

    latest = groups[0]
    maximum = latest.get("max", {})
    dimensions = latest.get("dimensions", {})

    return {
        "bucket_name": bucket_name,
        "object_count": maximum.get("objectCount", 0),
        "payload_size_bytes": maximum.get("payloadSize", 0),
        "metadata_size_bytes": maximum.get("metadataSize", 0),
        "upload_count": maximum.get("uploadCount", 0),
        "measured_at": dimensions.get("datetime"),
    }


def get_d1_daily_metrics() -> dict[str, Any]:
    account_id = settings.cloudflare_account_id
    database_id = settings.cloudflare_d1_database_id

    if not account_id:
        raise CloudflareMetricsError(
            "CLOUDFLARE_ACCOUNT_ID não está configurado."
        )

    if not database_id:
        raise CloudflareMetricsError(
            "CLOUDFLARE_D1_DATABASE_ID não está configurado."
        )

    query = """
    query D1Usage(
        $accountTag: string!
        $start: Date
        $end: Date
        $databaseId: string
    ) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                d1AnalyticsAdaptiveGroups(
                    limit: 100
                    filter: {
                        date_geq: $start
                        date_leq: $end
                        databaseId: $databaseId
                    }
                ) {
                    sum {
                        readQueries
                        writeQueries
                        rowsRead
                        rowsWritten
                    }
                    dimensions {
                        date
                        databaseId
                    }
                }
            }
        }
    }
    """

    today = datetime.now(timezone.utc).date().isoformat()

    data = _graphql_request(
        query,
        {
            "accountTag": account_id,
            "start": today,
            "end": today,
            "databaseId": database_id,
        },
    )

    accounts = data.get("viewer", {}).get("accounts", [])

    if not accounts:
        raise CloudflareMetricsError(
            "A Cloudflare não devolveu dados D1 para esta conta."
        )

    groups = accounts[0].get("d1AnalyticsAdaptiveGroups", [])

    rows_read = 0
    rows_written = 0
    read_queries = 0
    write_queries = 0

    for group in groups:
        values = group.get("sum", {})

        rows_read += values.get("rowsRead", 0) or 0
        rows_written += values.get("rowsWritten", 0) or 0
        read_queries += values.get("readQueries", 0) or 0
        write_queries += values.get("writeQueries", 0) or 0

    return {
        "database_id": database_id,
        "date": today,
        "rows_read": rows_read,
        "rows_written": rows_written,
        "read_queries": read_queries,
        "write_queries": write_queries,
    }


def get_d1_storage_metrics() -> dict[str, Any]:
    account_id = settings.cloudflare_account_id
    database_id = settings.cloudflare_d1_database_id

    if not account_id:
        raise CloudflareMetricsError(
            "CLOUDFLARE_ACCOUNT_ID não está configurado."
        )

    if not database_id:
        raise CloudflareMetricsError(
            "CLOUDFLARE_D1_DATABASE_ID não está configurado."
        )

    query = """
    query D1Storage(
        $accountTag: string!
        $databaseId: string
        $start: Date
        $end: Date
    ) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                d1StorageAdaptiveGroups(
                    limit: 1
                    filter: {
                        databaseId: $databaseId
                        date_geq: $start
                        date_leq: $end
                    }
                    orderBy: [date_DESC]
                ) {
                    max {
                        databaseSizeBytes
                    }
                    dimensions {
                        date
                        databaseId
                    }
                }
            }
        }
    }
    """

    today = datetime.now(timezone.utc).date()
    start_date = today.replace(day=1).isoformat()
    end_date = today.isoformat()

    data = _graphql_request(
        query,
        {
            "accountTag": account_id,
            "databaseId": database_id,
            "start": start_date,
            "end": end_date,
        },
    )

    accounts = data.get("viewer", {}).get("accounts", [])

    if not accounts:
        raise CloudflareMetricsError(
            "A Cloudflare não devolveu dados de armazenamento D1."
        )

    groups = accounts[0].get("d1StorageAdaptiveGroups", [])

    if not groups:
        return {
            "database_id": database_id,
            "database_size_bytes": 0,
            "measured_date": None,
        }

    latest = groups[0]

    return {
        "database_id": database_id,
        "database_size_bytes": latest.get("max", {}).get(
            "databaseSizeBytes",
            0,
        ),
        "measured_date": latest.get("dimensions", {}).get("date"),
    }


def get_cloudflare_metrics() -> dict[str, Any]:
    return {
        "status": "online",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "r2": get_r2_storage_metrics(),
        "d1": {
            **get_d1_daily_metrics(),
            **get_d1_storage_metrics(),
        },
    }