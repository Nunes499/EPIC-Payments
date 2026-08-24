from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException, status


CLOUDFLARE_API_BASE = (
    "https://api.cloudflare.com/client/v4"
)


def _get_required_env(
    name: str,
) -> str:
    value = (
        os.getenv(name)
        or ""
    ).strip()

    if not value:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                f"Configuração em falta: {name}."
            ),
        )

    return value


def _get_query_url() -> str:
    account_id = _get_required_env(
        "CLOUDFLARE_ACCOUNT_ID"
    )

    database_id = _get_required_env(
        "CLOUDFLARE_D1_DATABASE_ID"
    )

    return (
        f"{CLOUDFLARE_API_BASE}"
        f"/accounts/{account_id}"
        f"/d1/database/{database_id}/query"
    )


def _extract_query_result(
    payload: dict[str, Any],
) -> dict[str, Any]:

    if not payload.get("success"):
        errors = (
            payload.get("errors")
            or []
        )

        message = (
            "Falha ao consultar o Cloudflare D1."
        )

        if errors:
            first_error = (
                errors[0]
                or {}
            )

            message = (
                first_error.get("message")
                or message
            )

        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=message,
        )

    result = payload.get(
        "result"
    )

    if isinstance(
        result,
        list,
    ):
        if not result:
            return {
                "results": [],
                "meta": {},
                "success": True,
            }

        query_result = (
            result[0]
        )

    elif isinstance(
        result,
        dict,
    ):
        query_result = result

    else:
        query_result = {
            "results": [],
            "meta": {},
            "success": True,
        }

    if not query_result.get(
        "success",
        True,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "O Cloudflare D1 rejeitou "
                "a consulta."
            ),
        )

    return query_result


def execute_d1_query(
    sql: str,
    params: list[Any] | None = None,
) -> dict[str, Any]:
    """
    Executa SQL parametrizado no Cloudflare D1.
    """

    token = _get_required_env(
        "CLOUDFLARE_D1_API_TOKEN"
    )

    body = {
        "sql": sql,
        "params": (
            params
            or []
        ),
    }

    request = Request(
        _get_query_url(),
        data=json.dumps(
            body
        ).encode(
            "utf-8"
        ),
        headers={
            "Authorization": (
                f"Bearer {token}"
            ),
            "Content-Type": (
                "application/json"
            ),
        },
        method="POST",
    )

    try:
        with urlopen(
            request,
            timeout=20,
        ) as response:
            payload = json.loads(
                response
                .read()
                .decode(
                    "utf-8"
                )
            )

    except HTTPError as exc:
        try:
            error_payload = json.loads(
                exc.read().decode(
                    "utf-8"
                )
            )

            errors = (
                error_payload
                .get("errors")
                or []
            )

            detail = (
                errors[0].get(
                    "message"
                )
                if errors
                else None
            )

        except Exception:
            detail = None

        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                detail
                or
                "Erro de comunicação "
                "com o Cloudflare D1."
            ),
        ) from exc

    except (
        URLError,
        TimeoutError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Não foi possível comunicar "
                "com o Cloudflare D1."
            ),
        ) from exc

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "O Cloudflare D1 devolveu "
                "uma resposta inválida."
            ),
        ) from exc

    return _extract_query_result(
        payload
    )


def get_d1_rows(
    sql: str,
    params: list[Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Executa a consulta e devolve apenas as linhas.
    """

    query_result = (
        execute_d1_query(
            sql,
            params,
        )
    )

    rows = (
        query_result.get(
            "results"
        )
        or []
    )

    return [
        row
        for row in rows
        if isinstance(
            row,
            dict,
        )
    ]