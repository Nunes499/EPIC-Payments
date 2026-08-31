from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class SmsHistory(Base):
    __tablename__ = "sms_history"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="communication",
        index=True,
    )

    member_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="",
    )

    member_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        default="",
    )

    phone: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    entity: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    reference: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    message_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    sms_id: Mapped[str] = mapped_column(
        String(160),
        nullable=False,
        default="",
    )

    sent_by_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    sent_by_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    __table_args__ = (
        Index(
            "ix_sms_history_source_sent_at",
            "source",
            "sent_at",
        ),
    )
