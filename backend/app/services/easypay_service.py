from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import requests

from app.core.config import settings


class EasypayError(Exception):
    """
    Erro confirmado na comunicação/operação Easypay.

    Quando este erro é lançado após uma resposta HTTP
    válida da Easypay, o backend pode registar a tentativa
    como falhada.
    """

    pass


class EasypayUncertainError(EasypayError):
    """
    O resultado da operação é desconhecido.

    Exemplo:
    - timeout depois de o pedido ter sido enviado;
    - falha de transporte em que não conseguimos saber
      se a Easypay chegou ou não a criar a operação.

    Nestes casos NÃO devemos criar automaticamente uma
    nova referência.
    """

    pass


def _credentials() -> tuple[str, str, str]:
    account_id = (
        settings.easypay_account_id
        .strip()
    )

    api_key = (
        settings.easypay_api_key
        .strip()
    )

    base_url = (
        settings.easypay_api_url
        .strip()
        .rstrip("/")
    )

    if (
        not account_id
        or not api_key
    ):
        raise EasypayError(
            "As credenciais Easypay não estão configuradas."
        )

    if not base_url:
        raise EasypayError(
            "O endereço da API Easypay não está configurado."
        )

    return (
        account_id,
        api_key,
        base_url,
    )


def _headers() -> dict[str, str]:
    account_id, api_key, _ = (
        _credentials()
    )

    return {
        "AccountId": account_id,
        "ApiKey": api_key,
        "Accept": "application/json",
    }


def _extract_multibanco_details(
    data: dict[str, Any],
) -> tuple[str, str]:
    method = data.get(
        "method"
    )

    if not isinstance(
        method,
        dict,
    ):
        raise EasypayUncertainError(
            "A Easypay criou ou recebeu a operação, "
            "mas não devolveu os dados do método "
            "de pagamento."
        )

    entity = method.get(
        "entity"
    )

    reference = method.get(
        "reference"
    )

    if (
        not entity
        or not reference
    ):
        raise EasypayUncertainError(
            "A Easypay criou ou recebeu a operação, "
            "mas não devolveu Entidade e Referência."
        )

    return (
        str(entity),
        str(reference),
    )


def _build_expiration_time() -> str:
    expiration = (
        datetime.now(
            timezone.utc
        )
        + timedelta(
            days=30
        )
    )

    return (
        expiration
        .replace(
            microsecond=0
        )
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


def _error_detail(
    response: requests.Response,
    data: dict[str, Any],
) -> str:
    messages = data.get(
        "message"
    )

    if isinstance(
        messages,
        list,
    ):
        return " | ".join(
            str(item)
            for item in messages
        )

    return str(
        messages
        or data.get(
            "detail"
        )
        or data.get(
            "error"
        )
        or "Erro devolvido pela Easypay."
    )


def _normalize_customer_phone(
    phone: str,
) -> str:
    digits = "".join(
        character
        for character in str(
            phone
        )
        if character.isdigit()
    )

    if digits.startswith(
        "00351"
    ):
        digits = digits[2:]

    if (
        len(digits) == 9
        and digits.startswith(
            "9"
        )
    ):
        digits = (
            "351"
            + digits
        )

    return digits


def create_multibanco_reference(
    *,
    value: Decimal,
    member_number: str,
    member_name: str,
    phone: str,
    operation_key: str,
) -> dict[str, Any]:
    """
    Cria uma referência Multibanco na Easypay.

    operation_key é criada e persistida pelo EPIC
    Payments ANTES desta função ser chamada.

    A mesma chave é enviada no campo `key` da Easypay,
    permitindo identificar posteriormente a operação.
    """

    if value < Decimal(
        "0.50"
    ):
        raise EasypayError(
            "A Easypay exige um valor mínimo de 0,50 €."
        )

    _, _, base_url = (
        _credentials()
    )

    amount = value.quantize(
        Decimal("0.01")
    )

    clean_member_number = (
        str(
            member_number
        )
        .strip()
    )

    clean_operation_key = (
        str(
            operation_key
        )
        .strip()
    )

    customer_phone = (
        _normalize_customer_phone(
            phone
        )
    )

    if not clean_member_number:
        raise EasypayError(
            "O número de sócio é obrigatório "
            "para criar a referência Easypay."
        )

    if not customer_phone:
        raise EasypayError(
            "O número de telemóvel é obrigatório "
            "para criar a referência Easypay."
        )

    if not clean_operation_key:
        raise EasypayError(
            "A operação EPIC não possui "
            "identificador interno."
        )

    if len(
        clean_operation_key
    ) > 50:
        raise EasypayError(
            "O identificador interno da operação "
            "excede o limite permitido."
        )

    expiration_time = (
        _build_expiration_time()
    )

    # A transaction_key também deriva da operation_key.
    # Assim conseguimos relacionar os dois lados da
    # operação sem gerar um segundo identificador aleatório.
    transaction_key = (
        clean_operation_key
    )[:50]

    payload = {
        "type": "sale",
        "method": "MB",
        "value": float(
            amount
        ),
        "currency": "EUR",

        # Identificador persistente criado pelo EPIC.
        "key": clean_operation_key,

        "customer": {
            "name": (
                member_name.strip()
                or "Socio EPIC Fitness"
            ),
            "phone": (
                customer_phone
            ),
        },

        "capture": {
            "descriptive": (
                "EPIC Fitness - "
                f"Socio {clean_member_number}"
            )[:255],

            "transaction_key": (
                transaction_key
            ),
        },

        "multibanco": {
            "expiration_time": (
                expiration_time
            ),
        },
    }

    headers = {
        **_headers(),
        "Content-Type":
            "application/json",
    }

    url = (
        f"{base_url}/single"
    )

    try:
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=20,
        )

    except requests.Timeout as exc:
        raise EasypayUncertainError(
            "A Easypay demorou demasiado a responder. "
            "A operação ficou com estado incerto e "
            "não deve ser repetida antes da reconciliação."
        ) from exc

    except requests.RequestException as exc:
        raise EasypayUncertainError(
            "A comunicação com a Easypay foi "
            "interrompida. Não é possível confirmar "
            "se a operação foi criada."
        ) from exc

    try:
        data = response.json()

    except ValueError as exc:
        # A Easypay respondeu, mas não conseguimos
        # interpretar o conteúdo. Não assumimos que
        # a operação falhou.
        raise EasypayUncertainError(
            "A Easypay respondeu com conteúdo inválido "
            f"(HTTP {response.status_code}). "
            "O estado da operação necessita de confirmação."
        ) from exc

    if not response.ok:
        # Aqui existe uma resposta HTTP explícita da
        # Easypay indicando que o pedido não foi aceite.
        raise EasypayError(
            "Easypay HTTP "
            f"{response.status_code}: "
            f"{_error_detail(response, data)}"
        )

    entity, reference = (
        _extract_multibanco_details(
            data
        )
    )

    easypay_id = str(
        data.get(
            "id"
        )
        or ""
    ).strip()

    if not easypay_id:
        # Recebemos sucesso mas não o ID necessário para
        # controlar a operação. Tratamos como incerto.
        raise EasypayUncertainError(
            "A Easypay respondeu com sucesso, "
            "mas não devolveu o identificador "
            "da operação."
        )

    return {
        "status": "created",
        "entity": entity,
        "reference": reference,
        "value": float(
            amount
        ),
        "expires_at": (
            expiration_time
        ),
        "easypay_id": (
            easypay_id
        ),

        # Mantemos este campo na resposta para não
        # quebrar o contrato atual do frontend.
        # Agora representa a operation_key persistente.
        "idempotency_key": (
            clean_operation_key
        ),

        "operation_key": (
            clean_operation_key
        ),
    }


def get_single_payment(
    easypay_id: str,
) -> dict[str, Any]:
    _, _, base_url = (
        _credentials()
    )

    clean_id = (
        easypay_id.strip()
    )

    if not clean_id:
        raise EasypayError(
            "A referência não possui "
            "identificador Easypay."
        )

    url = (
        f"{base_url}/single/"
        f"{clean_id}"
    )

    try:
        response = requests.get(
            url,
            headers=_headers(),
            timeout=20,
        )

    except requests.Timeout as exc:
        raise EasypayError(
            "A Easypay demorou "
            "demasiado a responder."
        ) from exc

    except requests.RequestException as exc:
        raise EasypayError(
            "Não foi possível consultar "
            "a Easypay."
        ) from exc

    try:
        data = response.json()

    except ValueError as exc:
        raise EasypayError(
            "A Easypay devolveu uma "
            "resposta inválida "
            f"(HTTP {response.status_code})."
        ) from exc

    if not response.ok:
        raise EasypayError(
            "Easypay HTTP "
            f"{response.status_code}: "
            f"{_error_detail(response, data)}"
        )

    return data

def find_single_payment_by_key(
    operation_key: str,
) -> dict[str, Any] | None:
    """
    Procura na Easypay uma operação Single através
    da operation_key criada pelo EPIC Payments.

    Retorna:
    - dict: quando existe exatamente uma operação;
    - None: quando nenhuma operação foi encontrada.

    Se forem encontradas várias operações com a mesma
    key, não escolhemos nenhuma automaticamente.
    """

    _, _, base_url = (
        _credentials()
    )

    clean_operation_key = (
        str(
            operation_key
        )
        .strip()
    )

    if not clean_operation_key:
        raise EasypayError(
            "A operação EPIC não possui "
            "identificador interno."
        )

    url = (
        f"{base_url}/single"
    )

    params = {
        "key": (
            clean_operation_key
        ),
        "records_per_page": 10,
    }

    try:
        response = requests.get(
            url,
            params=params,
            headers=_headers(),
            timeout=20,
        )

    except requests.Timeout as exc:
        raise EasypayUncertainError(
            "A Easypay demorou demasiado "
            "a responder durante a reconciliação."
        ) from exc

    except requests.RequestException as exc:
        raise EasypayUncertainError(
            "Não foi possível comunicar com a "
            "Easypay durante a reconciliação."
        ) from exc

    try:
        payload = (
            response.json()
        )

    except ValueError as exc:
        raise EasypayUncertainError(
            "A Easypay devolveu uma resposta "
            "inválida durante a reconciliação "
            f"(HTTP {response.status_code})."
        ) from exc

    if not response.ok:
        if isinstance(
            payload,
            dict,
        ):
            detail = (
                _error_detail(
                    response,
                    payload,
                )
            )
        else:
            detail = (
                "Erro devolvido pela Easypay."
            )

        raise EasypayError(
            "Easypay HTTP "
            f"{response.status_code}: "
            f"{detail}"
        )

    if not isinstance(
        payload,
        dict,
    ):
        raise EasypayUncertainError(
            "A Easypay devolveu um formato "
            "inesperado durante a reconciliação."
        )

    data = payload.get(
        "data"
    )

    if data is None:
        raise EasypayUncertainError(
            "A resposta de pesquisa da Easypay "
            "não contém a lista de operações."
        )

    if not isinstance(
        data,
        list,
    ):
        raise EasypayUncertainError(
            "A Easypay devolveu uma lista de "
            "operações num formato inesperado."
        )

    # Não confiamos apenas no filtro remoto.
    # Confirmamos novamente a key de cada resultado.
    matches: list[
        dict[str, Any]
    ] = []

    for item in data:
        if not isinstance(
            item,
            dict,
        ):
            continue

        remote_key = str(
            item.get(
                "key"
            )
            or ""
        ).strip()

        if (
            remote_key
            == clean_operation_key
        ):
            matches.append(
                item
            )

    if not matches:
        return None

    if len(matches) > 1:
        raise EasypayUncertainError(
            "Foram encontradas várias operações "
            "Easypay com a mesma chave EPIC. "
            "É necessária verificação manual."
        )

    result = (
        matches[0]
    )

    easypay_id = str(
        result.get(
            "id"
        )
        or ""
    ).strip()

    if not easypay_id:
        raise EasypayUncertainError(
            "A operação encontrada na Easypay "
            "não possui identificador."
        )

    return result