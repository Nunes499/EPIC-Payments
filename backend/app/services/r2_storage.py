from __future__ import annotations

from io import BytesIO

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from app.core.config import settings


R2_BUCKET_NAME = settings.r2_bucket_name.strip()
R2_ENDPOINT_URL = settings.r2_endpoint_url.strip()
R2_ACCESS_KEY_ID = settings.r2_access_key_id.strip()
R2_SECRET_ACCESS_KEY = settings.r2_secret_access_key.strip()


def validate_r2_configuration() -> None:
    missing: list[str] = []

    if not R2_BUCKET_NAME:
        missing.append(
            "R2_BUCKET_NAME"
        )

    if not R2_ENDPOINT_URL:
        missing.append(
            "R2_ENDPOINT_URL"
        )

    if not R2_ACCESS_KEY_ID:
        missing.append(
            "R2_ACCESS_KEY_ID"
        )

    if not R2_SECRET_ACCESS_KEY:
        missing.append(
            "R2_SECRET_ACCESS_KEY"
        )

    if missing:
        raise RuntimeError(
            "Configuração R2 incompleta. "
            "Variáveis em falta: "
            + ", ".join(missing)
        )


def get_r2_client():
    validate_r2_configuration()

    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
        ),
    )


def upload_bytes_to_r2(
    *,
    object_key: str,
    contents: bytes,
    content_type: str | None = None,
) -> None:
    """
    Envia bytes diretamente para o Cloudflare R2.
    """

    if not object_key:
        raise ValueError(
            "object_key é obrigatório."
        )

    if not contents:
        raise ValueError(
            "contents não pode estar vazio."
        )

    client = get_r2_client()

    extra_args = {}

    if content_type:
        extra_args[
            "ContentType"
        ] = content_type

    try:
        client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
            Body=contents,
            **extra_args,
        )

    except (
        BotoCoreError,
        ClientError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Não foi possível guardar "
                "o ficheiro no armazenamento R2."
            ),
        ) from exc


def download_bytes_from_r2(
    *,
    object_key: str,
) -> bytes:
    """
    Descarrega um objeto do R2
    e devolve o conteúdo em bytes.
    """

    client = get_r2_client()

    try:
        response = client.get_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
        )

        body = response[
            "Body"
        ]

        return body.read()

    except ClientError as exc:
        error_code = (
            exc.response
            .get("Error", {})
            .get("Code")
        )

        if error_code in {
            "NoSuchKey",
            "404",
            "NotFound",
        }:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "O ficheiro não foi encontrado "
                    "no armazenamento R2."
                ),
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Não foi possível obter "
                "o ficheiro do armazenamento R2."
            ),
        ) from exc

    except BotoCoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Erro de comunicação com "
                "o armazenamento R2."
            ),
        ) from exc


def delete_object_from_r2(
    *,
    object_key: str,
) -> None:
    """
    Remove um objeto do R2.
    """

    client = get_r2_client()

    try:
        client.delete_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
        )

    except (
        BotoCoreError,
        ClientError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Não foi possível eliminar "
                "o ficheiro do armazenamento R2."
            ),
        ) from exc


def object_exists_in_r2(
    *,
    object_key: str,
) -> bool:
    """
    Confirma se um objeto existe no bucket.
    """

    client = get_r2_client()

    try:
        client.head_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
        )

        return True

    except ClientError as exc:
        error_code = (
            exc.response
            .get("Error", {})
            .get("Code")
        )

        if error_code in {
            "404",
            "NoSuchKey",
            "NotFound",
        }:
            return False

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Não foi possível verificar "
                "o ficheiro no armazenamento R2."
            ),
        ) from exc

    except BotoCoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Erro de comunicação com "
                "o armazenamento R2."
            ),
        ) from exc


def build_file_response_buffer(
    *,
    object_key: str,
) -> BytesIO:
    """
    Helper para criar um buffer em memória
    a partir de um objeto R2.
    """

    contents = download_bytes_from_r2(
        object_key=object_key,
    )

    return BytesIO(
        contents
    )
