from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.models import User
from app.services.easypay_service import (
    EasypayError,
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


class MultibancoReferenceCreate(BaseModel):
    member_number: str = Field(
        min_length=1,
        max_length=50,
    )
    member_name: str = Field(
        default="",
        max_length=200,
    )
    value: Decimal = Field(
        gt=0,
        decimal_places=2,
    )


class MultibancoReferenceRead(BaseModel):
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


class SmsRead(BaseModel):
    status: str
    sms_id: str
    phone: str
    message: str


@router.post(
    "/multibanco-reference",
    response_model=MultibancoReferenceRead,
)
def create_reference(
    payload: MultibancoReferenceCreate,
    current_user: User = Depends(get_current_user),
):
    try:
        return create_multibanco_reference(
            value=payload.value,
            member_number=payload.member_number.strip(),
            member_name=payload.member_name.strip(),
        )
    except EasypayError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.post(
    "/sms",
    response_model=SmsRead,
)
def send_sms(
    payload: SmsCreate,
    current_user: User = Depends(get_current_user),
):
    try:
        return send_payment_sms(
            phone=payload.phone.strip(),
            entity=payload.entity.strip(),
            reference=payload.reference.strip(),
            value=payload.value,
        )
    except SmsupError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
