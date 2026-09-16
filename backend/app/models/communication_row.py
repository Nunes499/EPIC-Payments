from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.database.session import Base


class CommunicationRow(Base):
    __tablename__ = "communication_rows"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    # ID atual do ficheiro no D1.
    #
    # É apenas informativo e útil para diagnóstico.
    # NÃO é ForeignKey porque calendar_files vive no D1,
    # enquanto communication_rows vive no Neon.
    source_file_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    # Identidade estável do ficheiro.
    #
    # Normalmente:
    # r2://bank-files/...
    #
    # Esta chave continua válida mesmo que o índice
    # calendar_files do D1 seja reconstruído.
    source_file_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )

    # Sequência determinística do movimento dentro
    # do respetivo ficheiro bancário.
    sequence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # =====================================================
    # ESTADO EDITÁVEL DA COMUNICAÇÃO
    # =====================================================

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
    )

    age: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )

    phone: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="",
    )

    # Mantemos o valor como texto porque este registo
    # representa também o estado editável do formulário.
    #
    # O valor financeiro oficial de uma referência criada
    # continua guardado em payment_references.value.
    amount: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="",
    )

    # Justificação introduzida manualmente.
    reason: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="",
    )

    # =====================================================
    # REFERÊNCIA MULTIBANCO / EASYpay
    # =====================================================

    payment_reference_id: Mapped[
        int | None
    ] = mapped_column(
        ForeignKey(
            "payment_references.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # =====================================================
    # SMS
    # =====================================================

    sms_history_id: Mapped[
        int | None
    ] = mapped_column(
        ForeignKey(
            "sms_history.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # =====================================================
    # AUDITORIA
    # =====================================================

    updated_by_id: Mapped[
        int | None
    ] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        index=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "source_file_key",
            "sequence",
            name=(
                "uq_communication_rows_"
                "file_key_sequence"
            ),
        ),
        Index(
            "ix_communication_rows_file_id_sequence",
            "source_file_id",
            "sequence",
        ),
    )