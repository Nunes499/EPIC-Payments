from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

import requests

from app.core.config import settings


class EasypayError(Exception):
    pass


def _extract_multibanco_details(
    data: dict[str, Any],
) -> tuple[str, str]:
    method = data.get("method")

    if not isinstance(method, dict):
        raise EasypayError(
            "A Easypay criou a operação, mas não devolveu "
            "os dados do método de pagamento."
        )

    entity = method.get("entity")
    reference = method.get("reference")

    if not entity or not reference:
        raise EasypayError(
            "A Easypay criou a operação, mas não devolveu "
            "Entidade e Referência."
        )

    return str(entity), str(reference)


def _build_expiration_time() -> str:
    expiration = (
        datetime.now(timezone.utc)
        + timedelta(days=30)
    )

    return expiration.replace(
        microsecond=0
    ).isoformat().replace(
        "+00:00",
        "Z",
    )


def create_multibanco_reference(
    *,
    value: Decimal,
    member_number: str,
    member_name: str,
) -> dict[str, Any]:
    if value < Decimal("0.50"):
        raise EasypayError(
            "A Easypay exige um valor mínimo de 0,50 €."
        )

    account_id = settings.easypay_account_id.strip()
    api_key = settings.easypay_api_key.strip()
    base_url = settings.easypay_api_url.strip().rstrip("/")

    if not account_id or not api_key:
        raise EasypayError(
            "As credenciais Easypay não estão configuradas."
        )

    if not base_url:
        raise EasypayError(
            "O endereço da API Easypay não está configurado."
        )

    amount = value.quantize(
        Decimal("0.01")
    )

    expiration_time = _build_expiration_time()

    idempotency_key = str(
        uuid4()
    )

    transaction_key = (
        f"EPIC-{member_number}-{uuid4().hex[:10]}"
    )[:50]

    payload = {
        "type": "sale",
        "method": "MB",
        "value": float(amount),
        "currency": "EUR",
        "key": str(member_number)[:50],
        "customer": {
            "name": (
                member_name.strip()
                or "Socio EPIC Fitness"
            ),
        },
        "capture": {
            "descriptive": (
                f"EPIC Fitness - Socio {member_number}"
            )[:255],
            "transaction_key": transaction_key,
        },
        "multibanco": {
            "expiration_time": expiration_time,
        },
    }

    headers = {
        "AccountId": account_id,
        "ApiKey": api_key,
        "Idempotency-Key": idempotency_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    url = f"{base_url}/single"

    try:
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=20,
        )
    except requests.Timeout as exc:
        raise EasypayError(
            "A Easypay demorou demasiado a responder. "
            "Não volte a criar esta referência antes "
            "de confirmar a operação no BackOffice."
        ) from exc
    except requests.RequestException as exc:
        raise EasypayError(
            "Não foi possível comunicar com a Easypay."
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise EasypayError(
            f"A Easypay devolveu uma resposta inválida "
            f"(HTTP {response.status_code})."
        ) from exc

    if not response.ok:
        messages = data.get("message")

        if isinstance(messages, list):
            detail = " | ".join(
                str(item)
                for item in messages
            )
        else:
            detail = (
                messages
                or data.get("detail")
                or data.get("error")
                or "Erro devolvido pela Easypay."
            )

        raise EasypayError(
            f"Easypay HTTP {response.status_code}: {detail}"
        )

    entity, reference = (
        _extract_multibanco_details(data)
    )

    easypay_id = str(
        data.get("id")
        or ""
    )

    return {
        "status": "created",
        "entity": entity,
        "reference": reference,
        "value": float(amount),
        "expires_at": expiration_time,
        "easypay_id": easypay_id,
        "idempotency_key": idempotency_key,
    }