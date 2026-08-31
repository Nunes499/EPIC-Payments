from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import require_admin
from app.models import User
from app.services.cloudflare_metrics_service import (
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