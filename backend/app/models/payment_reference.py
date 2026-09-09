from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class PaymentReference(Base):
    __tablename__ = "payment_references"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    member_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="",
        index=True,
    )

    member_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        default="",
        index=True,
    )

    value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    entity: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    reference: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    easypay_id: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        unique=True,
        index=True,
    )

    payment_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        index=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_by_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        Index(
            "ix_payment_references_status_created_at",
            "payment_status",
            "created_at",
        ),
    )
