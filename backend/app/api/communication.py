from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import (
    BaseModel,
    Field,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
)
from app.database.session import get_db
from app.models import (
    PaymentReference,
    SmsHistory,
    User,
)
from app.schemas.calendar_file import (
    CalendarFileRead,
)
from app.services.communication_report_service import (
    create_communication_report,
)
from app.services.easypay_service import (
    EasypayError,
    EasypayUncertainError,
    create_multibanco_reference,
)
from app.services.sms_service import (
    SmsupError,
    send_payment_sms,
)


router = APIRouter(
    prefix="/communication",
    tags=["Communication"],
)


class MultibancoReferenceCreate(
    BaseModel
):
    member_number: str = Field(
        min_length=1,
        max_length=50,
    )
    member_name: str = Field(
        default="",
        max_length=200,
    )
    phone: str = Field(
        min_length=1,
        max_length=40,
    )
    value: Decimal = Field(
        gt=0,
        decimal_places=2,
    )


class MultibancoReferenceRead(
    BaseModel
):
    status: str
    entity: str
    reference: str
    value: float
    expires_at: str
    easypay_id: str
    idempotency_key: str


class SmsCreate(BaseModel):
    phone: str = Field(
        min_length=1,
        max_length=40,
    )
    entity: str = Field(
        min_length=1,
        max_length=30,
    )
    reference: str = Field(
        min_length=1,
        max_length=50,
    )
    value: Decimal = Field(
        gt=0,
        decimal_places=2,
    )
    message_type: Literal[
        "informative",
        "returned",
    ] = "returned"

    source: Literal[
        "communication",
        "create_reference",
    ] = "communication"

    member_number: str = Field(
        default="",
        max_length=50,
    )

    member_name: str = Field(
        default="",
        max_length=200,
    )


class SmsRead(BaseModel):
    status: str
    sms_id: str
    phone: str
    message: str


class SmsHistoryRead(BaseModel):
    id: int
    source: str
    member_number: str
    member_name: str
    phone: str
    entity: str
    reference: str
    value: float
    message_type: str
    message: str
    sms_id: str
    sent_by_id: int | None
    sent_by_name: str
    sent_at: datetime


class CommunicationReportRow(
    BaseModel
):
    member_number: str = ""
    name: str = ""
    phone: str = ""
    value: Decimal = Field(
        gt=0,
        decimal_places=2,
    )
    entity: str = ""
    reference: str = ""
    sms_status: Literal[
        "pending",
        "sent",
        "failed",
    ]
    reason: str = ""


class CommunicationReportCreate(
    BaseModel
):
    calendar_date: date
    source_file_id: int | None = None
    source_filename: str = ""
    cedis_filename: str = ""
    rows: list[
        CommunicationReportRow
    ]


def _parse_iso_datetime(
    value: str,
) -> datetime | None:
    text = (
        value.strip()
    )

    if not text:
        return None

    try:
        if text.endswith("Z"):
            text = (
                text[:-1]
                + "+00:00"
            )

        result = (
            datetime.fromisoformat(
                text
            )
        )

        if result.tzinfo is None:
            result = (
                result.replace(
                    tzinfo=timezone.utc
                )
            )

        return result
    except ValueError:
        return None


@router.post(
    "/multibanco-reference",
    response_model=(
        MultibancoReferenceRead
    ),
)
def create_reference(
    payload: MultibancoReferenceCreate,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    # =====================================================
    # 1. IDENTIFICADOR ÚNICO DA OPERAÇÃO EPIC
    # =====================================================

    operation_key = (
        "EPIC-"
        + uuid4().hex
    )

    now = datetime.now(
        timezone.utc
    )

    # =====================================================
    # 2. REGISTAR PRIMEIRO NO NEON
    # =====================================================
    #
    # A operação passa a existir na nossa base ANTES
    # de qualquer pedido ser enviado à Easypay.
    #
    # Se este commit falhar, a Easypay nem sequer
    # é contactada.

    item = PaymentReference(
        member_number=(
            payload
            .member_number
            .strip()
        ),
        member_name=(
            payload
            .member_name
            .strip()
        ),
        value=payload.value,

        operation_key=(
            operation_key
        ),

        creation_status=(
            "creating"
        ),

        creation_error=None,

        creation_checked_at=(
            now
        ),

        entity=None,
        reference=None,
        easypay_id=None,

        payment_status=(
            "pending"
        ),

        expires_at=None,
        paid_at=None,

        created_by_id=(
            current_user.id
        ),

        created_by_name=(
            current_user.name
        ),

        checked_at=None,
    )

    try:
        db.add(
            item
        )

        db.commit()

        db.refresh(
            item
        )

    except Exception as exc:
        db.rollback()

        # Neste ponto a Easypay AINDA NÃO foi chamada.
        # Portanto podemos devolver erro com segurança.
        raise HTTPException(
            status_code=503,
            detail=(
                "Não foi possível registar a operação "
                "no EPIC Payments. "
                "Nenhuma referência foi solicitada "
                "à Easypay."
            ),
        ) from exc

    # =====================================================
    # 3. CHAMAR EASYpay
    # =====================================================

    try:
        result = (
            create_multibanco_reference(
                value=payload.value,

                member_number=(
                    payload
                    .member_number
                    .strip()
                ),

                member_name=(
                    payload
                    .member_name
                    .strip()
                ),

                phone=(
                    payload
                    .phone
                    .strip()
                ),

                operation_key=(
                    operation_key
                ),
            )
        )

    # =====================================================
    # 4A. RESULTADO INCERTO
    # =====================================================
    #
    # Timeout, interrupção de rede ou resposta inválida.
    #
    # NÃO apagamos a operação.
    # NÃO permitimos assumir que falhou.
    # NÃO criamos outra referência automaticamente.

    except EasypayUncertainError as exc:
        try:
            item.creation_status = (
                "creation_unknown"
            )

            item.creation_error = (
                str(exc)[:500]
            )

            item.creation_checked_at = (
                datetime.now(
                    timezone.utc
                )
            )

            db.add(
                item
            )

            db.commit()

        except Exception:
            db.rollback()

        raise HTTPException(
            status_code=503,
            detail=(
                "A Easypay não confirmou o resultado "
                "da operação. "
                "O pedido ficou registado para "
                "reconciliação e não deve ser repetido "
                "manualmente."
            ),
        ) from exc

    # =====================================================
    # 4B. FALHA CONFIRMADA
    # =====================================================

    except EasypayError as exc:
        try:
            item.creation_status = (
                "creation_failed"
            )

            item.creation_error = (
                str(exc)[:500]
            )

            item.creation_checked_at = (
                datetime.now(
                    timezone.utc
                )
            )

            db.add(
                item
            )

            db.commit()

        except Exception:
            db.rollback()

        raise HTTPException(
            status_code=502,
            detail=str(
                exc
            ),
        ) from exc

    # =====================================================
    # 5. EASYpay RESPONDEU COM SUCESSO
    # =====================================================

    easypay_id = str(
        result.get(
            "easypay_id"
        )
        or ""
    ).strip()

    entity = str(
        result.get(
            "entity"
        )
        or ""
    ).strip()

    reference = str(
        result.get(
            "reference"
        )
        or ""
    ).strip()

    if (
        not easypay_id
        or not entity
        or not reference
    ):
        # Por proteção adicional.
        # O serviço já valida isto, mas não assumimos
        # que dados financeiros incompletos são sucesso.

        item.creation_status = (
            "creation_unknown"
        )

        item.creation_error = (
            "A Easypay respondeu sem todos "
            "os identificadores obrigatórios."
        )

        item.creation_checked_at = (
            datetime.now(
                timezone.utc
            )
        )

        try:
            db.add(
                item
            )

            db.commit()

        except Exception:
            db.rollback()

        raise HTTPException(
            status_code=503,
            detail=(
                "A Easypay respondeu com dados "
                "incompletos. A operação ficou "
                "registada para reconciliação."
            ),
        )

    # =====================================================
    # 6. COMPLETAR O MESMO REGISTO NO NEON
    # =====================================================

    item.entity = (
        entity
    )

    item.reference = (
        reference
    )

    item.easypay_id = (
        easypay_id
    )

    item.expires_at = (
        _parse_iso_datetime(
            str(
                result.get(
                    "expires_at"
                )
                or ""
            )
        )
    )

    item.creation_status = (
        "created"
    )

    item.creation_error = None

    item.creation_checked_at = (
        datetime.now(
            timezone.utc
        )
    )

    try:
        db.add(
            item
        )

        db.commit()

        db.refresh(
            item
        )

    except IntegrityError as exc:
        db.rollback()

        # A Easypay já criou a referência.
        # Não podemos simplesmente mandar repetir.
        #
        # O registo inicial continua no Neon através
        # da operation_key e poderá ser reconciliado.
        try:
            stored_item = db.get(
                PaymentReference,
                item.id,
            )

            if stored_item is not None:
                stored_item.creation_status = (
                    "creation_unknown"
                )

                stored_item.creation_error = (
                    "A referência foi criada na Easypay, "
                    "mas ocorreu um conflito ao guardar "
                    "os identificadores no EPIC Payments."
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

        raise HTTPException(
            status_code=503,
            detail=(
                "A referência foi criada na Easypay, "
                "mas necessita de reconciliação no "
                "EPIC Payments. Não repita o pedido."
            ),
        ) from exc

    except Exception as exc:
        db.rollback()

        # A referência já existe na Easypay.
        # Recuperamos o registo inicial pelo ID para
        # preservar o estado de operação incerta.

        try:
            stored_item = db.get(
                PaymentReference,
                item.id,
            )

            if stored_item is not None:
                stored_item.creation_status = (
                    "creation_unknown"
                )

                stored_item.creation_error = (
                    "A referência foi criada na Easypay, "
                    "mas não foi possível concluir a "
                    "persistência dos identificadores."
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

        raise HTTPException(
            status_code=503,
            detail=(
                "A referência foi criada na Easypay, "
                "mas o registo necessita de "
                "reconciliação. Não repita o pedido."
            ),
        ) from exc

    # =====================================================
    # 7. SUCESSO TOTAL
    # =====================================================

    return result


@router.post(
    "/sms",
    response_model=SmsRead,
)
def send_sms(
    payload: SmsCreate,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    try:
        result = send_payment_sms(
            phone=(
                payload.phone.strip()
            ),
            entity=(
                payload.entity.strip()
            ),
            reference=(
                payload.reference.strip()
            ),
            value=payload.value,
            message_type=(
                payload.message_type
            ),
        )

        history = SmsHistory(
            source=payload.source,
            member_number=(
                payload
                .member_number
                .strip()
            ),
            member_name=(
                payload
                .member_name
                .strip()
            ),
            phone=result["phone"],
            entity=(
                payload.entity.strip()
            ),
            reference=(
                payload
                .reference
                .strip()
            ),
            value=payload.value,
            message_type=(
                payload.message_type
            ),
            message=result["message"],
            sms_id=result["sms_id"],
            sent_by_id=(
                current_user.id
            ),
            sent_by_name=(
                current_user.name
            ),
        )

        db.add(
            history
        )
        db.commit()

        return result
    except SmsupError as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
    except Exception:
        db.rollback()
        raise


@router.get(
    "/sms-history",
    response_model=list[
        SmsHistoryRead
    ],
)
def get_sms_history(
    source: Literal[
        "communication",
        "create_reference",
    ] = "create_reference",
    limit: int = 10,
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
            50,
        ),
    )

    items = db.scalars(
        select(
            SmsHistory
        )
        .where(
            SmsHistory.source
            == source
        )
        .order_by(
            SmsHistory.sent_at.desc(),
            SmsHistory.id.desc(),
        )
        .limit(
            safe_limit
        )
    ).all()

    return [
        SmsHistoryRead(
            id=item.id,
            source=item.source,
            member_number=(
                item.member_number
            ),
            member_name=(
                item.member_name
            ),
            phone=item.phone,
            entity=item.entity,
            reference=item.reference,
            value=float(
                item.value
            ),
            message_type=(
                item.message_type
            ),
            message=item.message,
            sms_id=item.sms_id,
            sent_by_id=(
                item.sent_by_id
            ),
            sent_by_name=(
                item.sent_by_name
            ),
            sent_at=item.sent_at,
        )
        for item in items
    ]


@router.post(
    "/report",
    response_model=CalendarFileRead,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def attach_report(
    payload: CommunicationReportCreate,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    try:
        return create_communication_report(
            db,
            calendar_date=(
                payload.calendar_date
            ),
            source_file_id=(
                payload.source_file_id
            ),
            source_filename=(
                payload
                .source_filename
                .strip()
            ),
            cedis_filename=(
                payload
                .cedis_filename
                .strip()
            ),
            rows=[
                row.model_dump()
                for row in payload.rows
            ],
            uploaded_by_id=(
                current_user.id
            ),
            generated_by_name=(
                current_user.name
            ),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc),
        ) from exc
