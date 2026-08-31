from decimal import Decimal, InvalidOperation

import requests

from app.core.config import settings


class SmsupError(RuntimeError):
    pass


def _normalize_destination(phone: str) -> str:
    digits = "".join(
        character
        for character in phone
        if character.isdigit()
    )

    if not digits:
        raise SmsupError(
            "Indique um número de telemóvel válido."
        )

    if (
        len(digits) == 9
        and digits.startswith("9")
    ):
        digits = f"351{digits}"

    if len(digits) < 11:
        raise SmsupError(
            "O número de telemóvel deve incluir o indicativo internacional."
        )

    return digits


def _format_reference(reference: str) -> str:
    digits = "".join(
        character
        for character in reference
        if character.isdigit()
    )

    if not digits:
        return reference.strip()

    return " ".join(
        digits[index:index + 3]
        for index in range(
            0,
            len(digits),
            3,
        )
    )


def _format_value(value: Decimal) -> str:
    try:
        normalized = Decimal(value).quantize(
            Decimal("0.01")
        )
    except (
        InvalidOperation,
        ValueError,
        TypeError,
    ) as exc:
        raise SmsupError(
            "O valor da cobrança não é válido."
        ) from exc

    return (
        f"{normalized:.2f}"
        .replace(".", ",")
        + "€"
    )


def build_payment_sms(
    *,
    entity: str,
    reference: str,
    value: Decimal,
) -> str:
    return (
        "Estimado cliente,\n"
        "Nao foi possivel processar a sua cobranca por debito direto.\n"
        "Efetue o pagamento por:\n"
        f"Ent:{entity.strip()}\n"
        f"Ref:{_format_reference(reference)}\n"
        f"Valor: {_format_value(value)}\n"
        "EPIC FITNESS"
    )


def send_payment_sms(
    *,
    phone: str,
    entity: str,
    reference: str,
    value: Decimal,
) -> dict:
    api_key = settings.smsup_api_key.strip()

    if not api_key:
        raise SmsupError(
            "A chave da SMSUP não está configurada."
        )

    destination = _normalize_destination(
        phone
    )

    message = build_payment_sms(
        entity=entity,
        reference=reference,
        value=value,
    )

    payload = {
        "api_key": api_key,
        "concat": 1,
        "messages": [
            {
                "from": settings.smsup_sender.strip()
                or "EpicFitness",
                "to": destination,
                "text": message,
                "encoding": "UCS2",
            }
        ],
    }

    try:
        response = requests.post(
            settings.smsup_api_url.strip(),
            json=payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise SmsupError(
            "Não foi possível contactar o serviço de SMS."
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise SmsupError(
            f"A SMSUP devolveu uma resposta inválida (HTTP {response.status_code})."
        ) from exc

    if response.status_code >= 400:
        error_message = (
            data.get("error_msg")
            or data.get("error_id")
            or f"Erro HTTP {response.status_code}"
        )

        raise SmsupError(
            f"SMS não enviado: {error_message}"
        )

    if data.get("status") != "ok":
        error_message = (
            data.get("error_msg")
            or data.get("error_id")
            or "Erro desconhecido"
        )

        raise SmsupError(
            f"SMS não enviado: {error_message}"
        )

    results = data.get("result") or []

    if not results:
        raise SmsupError(
            "A SMSUP não devolveu o resultado do envio."
        )

    result = results[0]

    if result.get("status") != "ok":
        error_message = (
            result.get("error_msg")
            or result.get("error_id")
            or "Erro desconhecido"
        )

        if (
            result.get("error_id")
            == "NOT_ENOUGH_BALANCE"
        ):
            raise SmsupError(
                "SMS não enviado: saldo insuficiente na SMSUP."
            )

        raise SmsupError(
            f"SMS não enviado: {error_message}"
        )

    return {
        "status": "sent",
        "sms_id": str(
            result.get("sms_id") or ""
        ),
        "phone": destination,
        "message": message,
    }
