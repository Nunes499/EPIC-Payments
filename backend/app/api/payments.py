from datetime import datetime, timezone
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
)
from app.database.session import get_db
from app.models import (
    PaymentReference,
    User,
)
from app.services.easypay_service import (
    EasypayError,
    get_single_payment,
)


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


class PaymentReferenceRead(
    BaseModel
):
    id: int
    member_number: str
    member_name: str
    value: float
    entity: str
    reference: str
    easypay_id: str
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
        if text.endswith("Z"):
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
    raw = (
        item.payment_status
        or "pending"
    ).lower()

    if raw == "paid":
        return "paid"

    now = (
        datetime.now(
            timezone.utc
        )
    )

    expires_at = (
        item.expires_at
    )

    if (
        expires_at is not None
        and expires_at.tzinfo is None
    ):
        expires_at = (
            expires_at.replace(
                tzinfo=timezone.utc
            )
        )

    if (
        expires_at is not None
        and expires_at < now
        and raw in {
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
        entity=item.entity,
        reference=item.reference,
        easypay_id=(
            item.easypay_id
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


def _refresh_item(
    db: Session,
    item: PaymentReference,
) -> bool:
    data = get_single_payment(
        item.easypay_id
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
        and paid_at != item.paid_at
    ):
        item.paid_at = paid_at
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
                    PaymentReference.member_number.ilike(
                        pattern
                    ),
                    PaymentReference.member_name.ilike(
                        pattern
                    ),
                    PaymentReference.reference.ilike(
                        pattern
                    ),
                    PaymentReference.entity.ilike(
                        pattern
                    ),
                )
            )
        )

    items = list(
        db.scalars(
            statement
            .order_by(
                PaymentReference.created_at.desc(),
                PaymentReference.id.desc(),
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
            detail=str(exc),
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

    items = list(
        db.scalars(
            select(
                PaymentReference
            )
            .where(
                PaymentReference.payment_status.in_(
                    [
                        "pending",
                        "active",
                    ]
                )
            )
            .order_by(
                PaymentReference.created_at.desc()
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
