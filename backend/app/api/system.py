from fastapi import APIRouter, Depends, HTTPException, status
import requests

from app.api.dependencies import require_admin
from app.core.config import settings
from app.models import User
from app.services.cloudflare_metrics_service import (
    CLOUDFLARE_GRAPHQL_URL,
    CloudflareMetricsError,
    get_cloudflare_metrics,
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

        return {
            **result,
            "success": response.ok,
            "cloudflare_http_status": response.status_code,
            "cloudflare_response": cloudflare_body,
        }

    except requests.RequestException as exc:
        return {
            **result,
            "success": False,
            "request_error": str(exc),
        }