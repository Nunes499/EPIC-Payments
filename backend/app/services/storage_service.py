from app.services.r2_storage import (
    R2_BUCKET_NAME,
    delete_object_from_r2,
    get_r2_client,
    upload_bytes_to_r2,
)


def upload_object(
    object_key: str,
    contents: bytes,
    content_type: str | None = None,
) -> None:
    """
    Guarda um ficheiro no Cloudflare R2.
    """

    upload_bytes_to_r2(
        object_key=object_key,
        contents=contents,
        content_type=content_type,
    )


def download_object(
    object_key: str,
) -> tuple[bytes, str]:
    """
    Obtém um ficheiro do Cloudflare R2.

    Devolve:
    - conteúdo em bytes
    - tipo MIME do ficheiro
    """

    client = get_r2_client()

    response = client.get_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
    )

    contents = response["Body"].read()

    content_type = response.get(
        "ContentType",
        "application/octet-stream",
    )

    return contents, content_type


def delete_object(
    object_key: str,
) -> None:
    """
    Elimina um ficheiro do Cloudflare R2.
    """

    delete_object_from_r2(
        object_key=object_key,
    )