from datetime import datetime, timezone
import secrets
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPBasic,
    HTTPBasicCredentials,
)
from pydantic import BaseModel
from sqlalchemy import (
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
)
from app.core.config import settings
from app.database.session import get_db
from app.models import (
    PaymentReference,
    User,
)
from app.services.easypay_service import (
    EasypayError,
    EasypayUncertainError,
    find_single_payment_by_key,
    get_single_payment,
)

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


webhook_security = HTTPBasic(
    auto_error=False,
)


class PaymentReferenceRead(
    BaseModel
):
    id: int

    member_number: str
    member_name: str

    value: float

    entity: str | None
    reference: str | None
    easypay_id: str | None

    operation_key: str
    creation_status: str
    creation_error: str | None
    creation_checked_at: datetime | None

    payment_status: str
    display_status: str

    expires_at: datetime | None
    paid_at: datetime | None

    created_by_name: str
    created_at: datetime
    checked_at: datetime | None


class RefreshSummary(
    BaseModel
):
    checked: int
    updated: int
    failed: int


class EasypayWebhookTransaction(
    BaseModel
):
    id: str = ""
    key: str = ""
    type: str = ""
    date: str = ""


class EasypayTransactionWebhook(
    BaseModel
):
    id: str
    key: str = ""
    transaction: (
        EasypayWebhookTransaction
        | None
    ) = None


class EasypayWebhookResponse(
    BaseModel
):
    status: str
    payment_id: int | None = None
    payment_status: str | None = None


def _verify_webhook_credentials(
    credentials: HTTPBasicCredentials | None,
) -> None:
    expected_username = (
        settings
        .easypay_webhook_username
        .strip()
    )

    expected_password = (
        settings
        .easypay_webhook_password
        .strip()
    )

    if (
        not expected_username
        or not expected_password
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "O webhook Easypay ainda não está "
                "configurado no EPIC Payments."
            ),
        )

    if credentials is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Autenticação do webhook em falta."
            ),
            headers={
                "WWW-Authenticate": "Basic",
            },
        )

    username_ok = secrets.compare_digest(
        credentials.username,
        expected_username,
    )

    password_ok = secrets.compare_digest(
        credentials.password,
        expected_password,
    )

    if not (
        username_ok
        and password_ok
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Credenciais do webhook inválidas."
            ),
            headers={
                "WWW-Authenticate": "Basic",
            },
        )


def _find_webhook_payment(
    db: Session,
    payload: EasypayTransactionWebhook,
) -> PaymentReference | None:
    easypay_id = (
        payload.id
        or ""
    ).strip()

    if easypay_id:
        item = db.scalar(
            select(
                PaymentReference
            )
            .where(
                PaymentReference
                .easypay_id
                == easypay_id
            )
            .limit(1)
        )

        if item is not None:
            return item

    candidate_keys: list[str] = []

    payload_key = (
        payload.key
        or ""
    ).strip()

    if payload_key:
        candidate_keys.append(
            payload_key
        )

    if payload.transaction is not None:
        transaction_key = (
            payload.transaction.key
            or ""
        ).strip()

        if (
            transaction_key
            and transaction_key
            not in candidate_keys
        ):
            candidate_keys.append(
                transaction_key
            )

    for operation_key in candidate_keys:
        item = db.scalar(
            select(
                PaymentReference
            )
            .where(
                PaymentReference
                .operation_key
                == operation_key
            )
            .limit(1)
        )

        if item is not None:
            return item

    return None


def _parse_datetime(
    value: object,
) -> datetime | None:
    if not value:
        return None

    text = str(
        value
    ).strip()

    if not text:
        return None

    try:
        if text.endswith(
            "Z"
        ):
            text = (
                text[:-1]
                + "+00:00"
            )

        parsed = (
            datetime.fromisoformat(
                text
            )
        )

        if parsed.tzinfo is None:
            parsed = (
                parsed.replace(
                    tzinfo=timezone.utc
                )
            )

        return parsed

    except ValueError:
        pass

    for pattern in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ):
        try:
            return (
                datetime.strptime(
                    text,
                    pattern,
                )
                .replace(
                    tzinfo=timezone.utc
                )
            )

        except ValueError:
            continue

    return None


def _display_status(
    item: PaymentReference,
) -> str:
    creation_status = (
        item.creation_status
        or "created"
    ).lower()

    # Enquanto a criação não estiver concluída,
    # o estado da criação tem prioridade sobre
    # o estado financeiro do pagamento.
    if creation_status in {
        "creating",
        "creation_unknown",
        "creation_failed",
    }:
        return creation_status

    raw = (
        item.payment_status
        or "pending"
    ).lower()

    if raw == "paid":
        return "paid"

    now = datetime.now(
        timezone.utc
    )

    expires_at = (
        item.expires_at
    )

    if (
        expires_at is not None
        and expires_at.tzinfo
        is None
    ):
        expires_at = (
            expires_at.replace(
                tzinfo=timezone.utc
            )
        )

    if (
        expires_at is not None
        and expires_at < now
        and raw
        in {
            "pending",
            "active",
        }
    ):
        return "expired"

    return raw


def _serialize(
    item: PaymentReference,
) -> PaymentReferenceRead:
    return PaymentReferenceRead(
        id=item.id,

        member_number=(
            item.member_number
        ),

        member_name=(
            item.member_name
        ),

        value=float(
            item.value
        ),

        entity=(
            item.entity
        ),

        reference=(
            item.reference
        ),

        easypay_id=(
            item.easypay_id
        ),

        operation_key=(
            item.operation_key
        ),

        creation_status=(
            item.creation_status
        ),

        creation_error=(
            item.creation_error
        ),

        creation_checked_at=(
            item.creation_checked_at
        ),

        payment_status=(
            item.payment_status
        ),

        display_status=(
            _display_status(
                item
            )
        ),

        expires_at=(
            item.expires_at
        ),

        paid_at=(
            item.paid_at
        ),

        created_by_name=(
            item.created_by_name
        ),

        created_at=(
            item.created_at
        ),

        checked_at=(
            item.checked_at
        ),
    )

def _reconcile_unknown_item(
    db: Session,
    item: PaymentReference,
) -> bool:
    """
    Tenta recuperar uma operação cuja criação ficou
    com resultado incerto.

    A pesquisa é feita exclusivamente através da
    operation_key persistida no Neon e enviada
    anteriormente para a Easypay.
    """

    if (
        item.creation_status
        != "creation_unknown"
    ):
        return False

    operation_key = (
        item.operation_key
        or ""
    ).strip()

    if not operation_key:
        raise EasypayError(
            "A operação não possui "
            "operation_key para reconciliação."
        )

    data = (
        find_single_payment_by_key(
            operation_key
        )
    )

    item.creation_checked_at = (
        datetime.now(
            timezone.utc
        )
    )

    # A Easypay ainda não devolve nenhuma operação
    # com esta key.
    #
    # Não marcamos automaticamente como falhada:
    # mantemos creation_unknown para uma nova
    # verificação posterior.
    if data is None:
        item.creation_error = (
            "Nenhuma operação Easypay foi encontrada "
            "com esta chave na última reconciliação."
        )

        db.add(
            item
        )

        return False

    # Proteção adicional: mesmo tendo pesquisado
    # pela key, confirmamos que o resultado pertence
    # exatamente à nossa operação.
    remote_key = str(
        data.get(
            "key"
        )
        or ""
    ).strip()

    if (
        remote_key
        != operation_key
    ):
        raise EasypayUncertainError(
            "A operação encontrada na Easypay "
            "não corresponde à chave EPIC."
        )

    easypay_id = str(
        data.get(
            "id"
        )
        or ""
    ).strip()

    method = data.get(
        "method"
    )

    if not isinstance(
        method,
        dict,
    ):
        raise EasypayUncertainError(
            "A operação encontrada não possui "
            "dados válidos do método Multibanco."
        )

    entity = str(
        method.get(
            "entity"
        )
        or ""
    ).strip()

    reference = str(
        method.get(
            "reference"
        )
        or ""
    ).strip()

    if (
        not easypay_id
        or not entity
        or not reference
    ):
        raise EasypayUncertainError(
            "A operação encontrada na Easypay "
            "não contém todos os identificadores "
            "necessários."
        )

    payment_status = str(
        data.get(
            "payment_status"
        )
        or method.get(
            "status"
        )
        or "pending"
    ).lower()

    expires_at = (
        _parse_datetime(
            data.get(
                "expiration_time"
            )
        )
    )

    # Algumas respostas Easypay também incluem
    # expiration_time dentro de multibanco.
    if expires_at is None:
        multibanco = data.get(
            "multibanco"
        )

        if isinstance(
            multibanco,
            dict,
        ):
            expires_at = (
                _parse_datetime(
                    multibanco.get(
                        "expiration_time"
                    )
                )
            )

    paid_at = (
        _parse_datetime(
            data.get(
                "paid_at"
            )
        )
    )

    item.easypay_id = (
        easypay_id
    )

    item.entity = (
        entity
    )

    item.reference = (
        reference
    )

    item.payment_status = (
        payment_status
    )

    item.expires_at = (
        expires_at
    )

    if paid_at is not None:
        item.paid_at = (
            paid_at
        )

    item.creation_status = (
        "created"
    )

    item.creation_error = None

    item.checked_at = (
        datetime.now(
            timezone.utc
        )
    )

    db.add(
        item
    )

    return True

def _can_refresh_payment(
    item: PaymentReference,
) -> bool:
    """
    Só podemos consultar /single/{id} quando
    a criação da referência está concluída
    e possuímos um easypay_id.
    """

    return (
        (
            item.creation_status
            or "created"
        ).lower()
        == "created"
        and bool(
            (
                item.easypay_id
                or ""
            ).strip()
        )
    )


def _refresh_item(
    db: Session,
    item: PaymentReference,
) -> bool:
    if not _can_refresh_payment(
        item
    ):
        raise EasypayError(
            "Esta operação ainda não possui "
            "uma referência Easypay confirmada."
        )

    easypay_id = (
        item.easypay_id
        or ""
    ).strip()

    data = get_single_payment(
        easypay_id
    )

    new_status = str(
        data.get(
            "payment_status"
        )
        or item.payment_status
        or "pending"
    ).lower()

    paid_at = _parse_datetime(
        data.get(
            "paid_at"
        )
    )

    expires_at = _parse_datetime(
        data.get(
            "expiration_time"
        )
    )

    changed = False

    if (
        new_status
        != item.payment_status
    ):
        item.payment_status = (
            new_status
        )
        changed = True

    if (
        paid_at is not None
        and paid_at
        != item.paid_at
    ):
        item.paid_at = (
            paid_at
        )
        changed = True

    if (
        expires_at is not None
        and expires_at
        != item.expires_at
    ):
        item.expires_at = (
            expires_at
        )
        changed = True

    item.checked_at = (
        datetime.now(
            timezone.utc
        )
    )

    db.add(
        item
    )

    return changed


@router.post(
    "/easypay-webhook",
    response_model=EasypayWebhookResponse,
)
def easypay_transaction_webhook(
    payload: EasypayTransactionWebhook,
    credentials: (
        HTTPBasicCredentials
        | None
    ) = Depends(
        webhook_security
    ),
    db: Session = Depends(
        get_db
    ),
):
    """
    Recebe notificações de transação da Easypay.

    O JSON recebido nunca é usado como prova de
    pagamento. Depois de identificar a referência,
    o EPIC Payments consulta diretamente a API
    Easypay através do easypay_id já persistido.

    A operação é idempotente: notificações repetidas
    apenas voltam a confirmar o mesmo pagamento.
    """

    _verify_webhook_credentials(
        credentials
    )

    item = _find_webhook_payment(
        db,
        payload,
    )

    if item is None:
        # A notificação é válida, mas não pertence
        # a uma referência conhecida pelo EPIC.
        #
        # Respondemos 200 para evitar reenvios
        # intermináveis da mesma notificação.
        return EasypayWebhookResponse(
            status="ignored",
        )

    if not _can_refresh_payment(
        item
    ):
        # Se a criação estiver incerta, tentamos
        # primeiro recuperar a operação pela
        # operation_key já persistida.
        if (
            item.creation_status
            == "creation_unknown"
        ):
            try:
                reconciled = (
                    _reconcile_unknown_item(
                        db,
                        item,
                    )
                )

                db.commit()

                if reconciled:
                    db.refresh(
                        item
                    )

            except (
                EasypayError,
                EasypayUncertainError,
            ) as exc:
                db.rollback()

                raise HTTPException(
                    status_code=(
                        status.HTTP_502_BAD_GATEWAY
                    ),
                    detail=str(
                        exc
                    ),
                ) from exc

        if not _can_refresh_payment(
            item
        ):
            return EasypayWebhookResponse(
                status="ignored",
                payment_id=item.id,
                payment_status=(
                    item.payment_status
                ),
            )

    try:
        _refresh_item(
            db,
            item,
        )

        db.commit()

        db.refresh(
            item
        )

    except EasypayError as exc:
        db.rollback()

        # Não devolvemos 200 quando não conseguimos
        # confirmar a notificação diretamente na
        # Easypay. Isto permite que a entrega possa
        # ser novamente tentada.
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=str(
                exc
            ),
        ) from exc

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Não foi possível processar "
                "a notificação Easypay."
            ),
        ) from exc

    return EasypayWebhookResponse(
        status="processed",
        payment_id=item.id,
        payment_status=(
            item.payment_status
        ),
    )


@router.get(
    "",
    response_model=list[
        PaymentReferenceRead
    ],
)
def list_payments(
    status_filter: Literal[
        "all",
        "pending",
        "paid",
        "expired",
        "failed",
    ] = "all",
    search: str = "",
    limit: int = 300,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    del current_user

    safe_limit = max(
        1,
        min(
            limit,
            1000,
        ),
    )

    statement = select(
        PaymentReference
    )

    clean_search = (
        search.strip()
    )

    if clean_search:
        pattern = (
            f"%{clean_search}%"
        )

        statement = (
            statement.where(
                or_(
                    PaymentReference
                    .member_number
                    .ilike(
                        pattern
                    ),

                    PaymentReference
                    .member_name
                    .ilike(
                        pattern
                    ),

                    PaymentReference
                    .reference
                    .ilike(
                        pattern
                    ),

                    PaymentReference
                    .entity
                    .ilike(
                        pattern
                    ),

                    PaymentReference
                    .operation_key
                    .ilike(
                        pattern
                    ),
                )
            )
        )

    items = list(
        db.scalars(
            statement
            .order_by(
                PaymentReference
                .created_at
                .desc(),

                PaymentReference
                .id
                .desc(),
            )
            .limit(
                safe_limit
            )
        ).all()
    )

    if (
        status_filter
        != "all"
    ):
        items = [
            item
            for item in items
            if _display_status(
                item
            )
            == status_filter
        ]

    return [
        _serialize(
            item
        )
        for item in items
    ]


@router.post(
    "/{payment_id}/refresh",
    response_model=PaymentReferenceRead,
)
def refresh_payment(
    payment_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    del current_user

    item = db.get(
        PaymentReference,
        payment_id,
    )

    if item is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Referência não encontrada."
            ),
        )

    if not _can_refresh_payment(
        item
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Esta operação ainda não possui "
                "uma referência Easypay confirmada."
            ),
        )

    try:
        _refresh_item(
            db,
            item,
        )

        db.commit()

        db.refresh(
            item
        )

        return _serialize(
            item
        )

    except EasypayError as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=str(
                exc
            ),
        ) from exc


@router.post(
    "/refresh-pending",
    response_model=RefreshSummary,
)
def refresh_pending(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    del current_user

    # Só consultamos referências cuja criação
    # terminou com sucesso e que possuem ID Easypay.
    #
    # Operações creation_unknown serão tratadas
    # por um mecanismo próprio de reconciliação.
    items = list(
        db.scalars(
            select(
                PaymentReference
            )
            .where(
                PaymentReference
                .creation_status
                == "created"
            )
            .where(
                PaymentReference
                .easypay_id
                .is_not(
                    None
                )
            )
            .where(
                PaymentReference
                .payment_status
                .in_(
                    [
                        "pending",
                        "active",
                    ]
                )
            )
            .order_by(
                PaymentReference
                .created_at
                .desc()
            )
            .limit(
                100
            )
        ).all()
    )

    checked = 0
    updated = 0
    failed = 0

    for item in items:
        try:
            checked += 1

            if _refresh_item(
                db,
                item,
            ):
                updated += 1

            db.commit()

        except EasypayError:
            failed += 1
            db.rollback()

        except Exception:
            failed += 1
            db.rollback()

    return RefreshSummary(
        checked=checked,
        updated=updated,
        failed=failed,
    )

@router.post(
    "/reconcile-unknown",
    response_model=RefreshSummary,
)
def reconcile_unknown(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    """
    Tenta reconciliar operações cuja criação
    na Easypay ficou com resultado incerto.

    Esta rota nunca cria uma nova referência.
    Apenas procura na Easypay pela operation_key
    que já está persistida no Neon.
    """

    del current_user

    items = list(
        db.scalars(
            select(
                PaymentReference
            )
            .where(
                PaymentReference
                .creation_status
                == "creation_unknown"
            )
            .order_by(
                PaymentReference
                .created_at
                .asc()
            )
            .limit(
                100
            )
        ).all()
    )

    checked = 0
    updated = 0
    failed = 0

    for item in items:
        try:
            checked += 1

            if _reconcile_unknown_item(
                db,
                item,
            ):
                updated += 1

            db.commit()

        except (
            EasypayError,
            EasypayUncertainError,
        ) as exc:
            db.rollback()
            failed += 1

            # Depois do rollback voltamos a obter
            # o registo antes de guardar a informação
            # da tentativa de reconciliação.
            try:
                stored_item = db.get(
                    PaymentReference,
                    item.id,
                )

                if stored_item is not None:
                    stored_item.creation_error = (
                        str(exc)[:500]
                    )

                    stored_item.creation_checked_at = (
                        datetime.now(
                            timezone.utc
                        )
                    )

                    db.add(
                        stored_item
                    )

                    db.commit()

            except Exception:
                db.rollback()

        except Exception as exc:
            db.rollback()
            failed += 1

            try:
                stored_item = db.get(
                    PaymentReference,
                    item.id,
                )

                if stored_item is not None:
                    stored_item.creation_error = (
                        (
                            "Erro interno durante "
                            "a reconciliação: "
                            f"{exc}"
                        )[:500]
                    )

                    stored_item.creation_checked_at = (
                        datetime.now(
                            timezone.utc
                        )
                    )

                    db.add(
                        stored_item
                    )

                    db.commit()

            except Exception:
                db.rollback()

    return RefreshSummary(
        checked=checked,
        updated=updated,
        failed=failed,
    )