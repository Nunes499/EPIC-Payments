from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

import requests

from app.core.config import settings


class EasypayError(Exception):
    pass


def _credentials() -> tuple[str, str, str]:
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

    return account_id, api_key, base_url


def _headers() -> dict[str, str]:
    account_id, api_key, _ = _credentials()

    return {
        "AccountId": account_id,
        "ApiKey": api_key,
        "Accept": "application/json",
    }


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
    expiration = datetime.now(timezone.utc) + timedelta(days=30)

    return (
        expiration
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _error_detail(
    response: requests.Response,
    data: dict[str, Any],
) -> str:
    messages = data.get("message")

    if isinstance(messages, list):
        return " | ".join(str(item) for item in messages)

    return str(
        messages
        or data.get("detail")
        or data.get("error")
        or "Erro devolvido pela Easypay."
    )


def _normalize_customer_phone(phone: str) -> str:
    digits = "".join(
        character
        for character in str(phone)
        if character.isdigit()
    )

    if digits.startswith("00351"):
        digits = digits[2:]

    if len(digits) == 9 and digits.startswith("9"):
        digits = "351" + digits

    return digits


def create_multibanco_reference(
    *,
    value: Decimal,
    member_number: str,
    member_name: str,
    phone: str,
) -> dict[str, Any]:
    if value < Decimal("0.50"):
        raise EasypayError(
            "A Easypay exige um valor mínimo de 0,50 €."
        )

    _, _, base_url = _credentials()

    amount = value.quantize(Decimal("0.01"))
    clean_member_number = str(member_number).strip()
    customer_phone = _normalize_customer_phone(phone)

    if not clean_member_number:
        raise EasypayError(
            "O número de sócio é obrigatório para criar a referência Easypay."
        )

    if not customer_phone:
        raise EasypayError(
            "O número de telemóvel é obrigatório para criar a referência Easypay."
        )

    expiration_time = _build_expiration_time()
    idempotency_key = str(uuid4())

    transaction_key = (
        f"EPIC-{clean_member_number}-{uuid4().hex[:10]}"
    )[:50]

    payload = {
        "type": "sale",
        "method": "MB",
        "value": float(amount),
        "currency": "EUR",
        "key": clean_member_number[:50],
        "customer": {
            "name": (
                member_name.strip()
                or "Socio EPIC Fitness"
            ),
            "phone": customer_phone,
        },
        "capture": {
            "descriptive": (
                f"EPIC Fitness - Socio {clean_member_number}"
            )[:255],
            "transaction_key": transaction_key,
        },
        "multibanco": {
            "expiration_time": expiration_time,
        },
    }

    headers = {
        **_headers(),
        "Idempotency-Key": idempotency_key,
        "Content-Type": "application/json",
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
            "A Easypay devolveu uma resposta inválida "
            f"(HTTP {response.status_code})."
        ) from exc

    if not response.ok:
        raise EasypayError(
            "Easypay HTTP "
            f"{response.status_code}: "
            f"{_error_detail(response, data)}"
        )

    entity, reference = _extract_multibanco_details(data)
    easypay_id = str(data.get("id") or "")

    return {
        "status": "created",
        "entity": entity,
        "reference": reference,
        "value": float(amount),
        "expires_at": expiration_time,
        "easypay_id": easypay_id,
        "idempotency_key": idempotency_key,
    }


def get_single_payment(
    easypay_id: str,
) -> dict[str, Any]:
    _, _, base_url = _credentials()
    clean_id = easypay_id.strip()

    if not clean_id:
        raise EasypayError(
            "A referência não possui identificador Easypay."
        )

    url = f"{base_url}/single/{clean_id}"

    try:
        response = requests.get(
            url,
            headers=_headers(),
            timeout=20,
        )
    except requests.Timeout as exc:
        raise EasypayError(
            "A Easypay demorou demasiado a responder."
        ) from exc
    except requests.RequestException as exc:
        raise EasypayError(
            "Não foi possível consultar a Easypay."
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise EasypayError(
            "A Easypay devolveu uma resposta inválida "
            f"(HTTP {response.status_code})."
        ) from exc

    if not response.ok:
        raise EasypayError(
            "Easypay HTTP "
            f"{response.status_code}: "
            f"{_error_detail(response, data)}"
        )

    return data
