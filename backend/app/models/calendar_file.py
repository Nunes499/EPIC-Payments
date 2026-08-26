from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.session import Base


class CalendarFile(Base):
    __tablename__ = "calendar_files"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    calendar_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    stored_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )

    # Formato físico do ficheiro:
    # pdf / xml
    file_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Função bancária do ficheiro:
    # normal / returned / recovery
    #
    # Os ficheiros antigos ficam automaticamente
    # classificados como "normal".
    file_category: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="normal",
        server_default="normal",
        index=True,
    )

    # Usado exclusivamente nos ficheiros
    # de recuperação:
    #
    # NULL = não é recuperação
    # 1 = Ficheiro 1
    # 2 = Ficheiro 2
    recovery_part: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # Permite relacionar ficheiros.
    #
    # Exemplos:
    # - devolvidos -> ficheiro normal
    # - recuperação F2 -> recuperação F1
    #
    # A relação concreta será controlada
    # pela lógica do serviço.
    related_file_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "calendar_files.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    mime_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_size: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )