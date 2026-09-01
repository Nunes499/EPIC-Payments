from fastapi import APIRouter, Depends, HTTPException, status
import requests

from app.api.dependencies import require_admin
from app.core.config import settings
from app.models import User
from app.services.cloudflare_metrics_service import (
    CLOUDFLARE_GRAPHQL_URL,
    CloudflareMetricsError,
    get_cloudflare_metrics,
    get_r2_storage_metrics,
    get_d1_daily_metrics,
    get_d1_storage_metrics,
)


router = APIRouter(
    prefix="/system",
    tags=["System"],
)


@router.get("/cloudflare-metrics")
def cloudflare_metrics(
    current_user: User = Depends(require_admin),
):
    try:
        return get_cloudflare_metrics()

    except CloudflareMetricsError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/cloudflare-debug")
def cloudflare_debug(
    current_user: User = Depends(require_admin),
):
    token = settings.cloudflare_monitoring_api_token
    account_id = settings.cloudflare_account_id

    result = {
        "token_loaded": bool(token),
        "account_loaded": bool(account_id),
        "account_preview": (
            f"{account_id[:6]}...{account_id[-6:]}"
            if account_id
            else None
        ),
        "graphql_url": CLOUDFLARE_GRAPHQL_URL,
    }

    if not token or not account_id:
        return {
            **result,
            "success": False,
            "error": "Token ou Account ID não configurado.",
        }

    query = """
    query AccountCheck($accountTag: string!) {
        viewer {
            accounts(filter: {accountTag: $accountTag}) {
                accountTag
            }
        }
    }
    """

    try:
        response = requests.post(
            CLOUDFLARE_GRAPHQL_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "query": query,
                "variables": {
                    "accountTag": account_id,
                },
            },
            timeout=20,
        )

        try:
            cloudflare_body = response.json()
        except ValueError:
            cloudflare_body = response.text[:500]

        graphql_errors = (
            cloudflare_body.get("errors")
            if isinstance(cloudflare_body, dict)
            else None
        )

        return {
            **result,
            "success": response.ok and not graphql_errors,
            "cloudflare_http_status": response.status_code,
            "cloudflare_response": cloudflare_body,
        }

    except requests.RequestException as exc:
        return {
            **result,
            "success": False,
            "request_error": str(exc),
        }


@router.get("/cloudflare-debug-metrics")
def cloudflare_debug_metrics(
    current_user: User = Depends(require_admin),
):
    results = {}

    tests = {
        "r2_storage": get_r2_storage_metrics,
        "d1_daily": get_d1_daily_metrics,
        "d1_storage": get_d1_storage_metrics,
    }

    for name, func in tests.items():
        try:
            data = func()

            results[name] = {
                "success": True,
                "data": data,
            }

        except Exception as exc:
            results[name] = {
                "success": False,
                "error_type": type(exc).__name__,
                "error": str(exc),
            }

    return results


@router.get("/cloudflare-debug-schema")
def cloudflare_debug_schema(
    current_user: User = Depends(require_admin),
):
    token = settings.cloudflare_monitoring_api_token
    account_id = settings.cloudflare_account_id

    if not token or not account_id:
        return {
            "success": False,
            "error": "Token Cloudflare ou Account ID não configurado.",
        }

    query = """
    query DatasetSettings($accountTag: string!) {
        viewer {
            accounts(filter: {accountTag: $accountTag}) {
                settings {
                    r2StorageAdaptiveGroups {
                        enabled
                    }
                    d1AnalyticsAdaptiveGroups {
                        enabled
                    }
                    d1StorageAdaptiveGroups {
                        enabled
                    }
                }
            }
        }
    }
    """

    try:
        response = requests.post(
            CLOUDFLARE_GRAPHQL_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "query": query,
                "variables": {
                    "accountTag": account_id,
                },
            },
            timeout=20,
        )

        try:
            body = response.json()
        except ValueError:
            return {
                "success": False,
                "cloudflare_http_status": response.status_code,
                "error": "Resposta Cloudflare não é JSON.",
                "response_preview": response.text[:500],
            }

        errors = body.get("errors") or []

        accounts = (
            (body.get("data") or {})
            .get("viewer", {})
            .get("accounts", [])
        )

        settings_data = {}

        if accounts:
            settings_data = accounts[0].get("settings") or {}

        datasets = {
            "r2StorageAdaptiveGroups": (
                settings_data.get("r2StorageAdaptiveGroups") or {}
            ).get("enabled"),
            "d1AnalyticsAdaptiveGroups": (
                settings_data.get("d1AnalyticsAdaptiveGroups") or {}
            ).get("enabled"),
            "d1StorageAdaptiveGroups": (
                settings_data.get("d1StorageAdaptiveGroups") or {}
            ).get("enabled"),
        }

        return {
            "success": response.ok and not errors,
            "cloudflare_http_status": response.status_code,
            "graphql_errors": errors,
            "account_found": bool(accounts),
            "datasets": datasets,
            "cloudflare_response": body,
        }

    except requests.RequestException as exc:
        return {
            "success": False,
            "request_error": str(exc),
        }