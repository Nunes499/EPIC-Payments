from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.calendar_file import CalendarFileRead
from app.services.communication_report_service import (
    create_communication_report,
)
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


class CommunicationReportRow(BaseModel):
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


class CommunicationReportCreate(BaseModel):
    calendar_date: date
    source_file_id: int | None = None
    source_filename: str = ""
    cedis_filename: str = ""
    rows: list[CommunicationReportRow]


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


@router.post(
    "/report",
    response_model=CalendarFileRead,
    status_code=status.HTTP_201_CREATED,
)
def attach_report(
    payload: CommunicationReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return create_communication_report(
            db,
            calendar_date=payload.calendar_date,
            source_file_id=payload.source_file_id,
            source_filename=payload.source_filename.strip(),
            cedis_filename=payload.cedis_filename.strip(),
            rows=[
                row.model_dump()
                for row in payload.rows
            ],
            uploaded_by_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
