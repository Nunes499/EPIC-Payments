"""secure payment reference creation

Revision ID: 9a7b1c2d0002
Revises: 9a7b1c2d0001
Create Date: 2026-09-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a7b1c2d0002"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "9a7b1c2d0001"

branch_labels: Union[
    str,
    Sequence[str],
    None,
] = None

depends_on: Union[
    str,
    Sequence[str],
    None,
] = None


def upgrade() -> None:
    # Identificador interno persistente da tentativa
    # de criação da referência.
    op.add_column(
        "payment_references",
        sa.Column(
            "operation_key",
            sa.String(length=80),
            nullable=True,
        ),
    )

    # Estado do processo de criação na Easypay.
    #
    # creating:
    #   registo criado no EPIC, antes da chamada Easypay
    #
    # created:
    #   referência criada e persistida com sucesso
    #
    # creation_failed:
    #   a Easypay confirmou uma falha
    #
    # creation_unknown:
    #   resultado incerto, por exemplo timeout
    op.add_column(
        "payment_references",
        sa.Column(
            "creation_status",
            sa.String(length=30),
            nullable=False,
            server_default="created",
        ),
    )

    # Permite guardar informação sobre uma falha
    # sem depender de logs temporários do servidor.
    op.add_column(
        "payment_references",
        sa.Column(
            "creation_error",
            sa.String(length=500),
            nullable=True,
        ),
    )

    # Momento da última tentativa de criação ou
    # reconciliação da referência.
    op.add_column(
        "payment_references",
        sa.Column(
            "creation_checked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Antes da resposta da Easypay ainda não existem
    # estes três valores. Tornamo-los temporariamente
    # opcionais para permitir persistir primeiro a
    # operação no Neon.
    op.alter_column(
        "payment_references",
        "entity",
        existing_type=sa.String(length=30),
        nullable=True,
    )

    op.alter_column(
        "payment_references",
        "reference",
        existing_type=sa.String(length=50),
        nullable=True,
    )

    op.alter_column(
        "payment_references",
        "easypay_id",
        existing_type=sa.String(length=80),
        nullable=True,
    )

    # As referências já existentes foram criadas antes
    # da introdução de operation_key. Mantemo-las
    # válidas e criamos uma chave histórica determinística.
    op.execute(
        """
        UPDATE payment_references
        SET operation_key = 'LEGACY-' || id::text
        WHERE operation_key IS NULL
        """
    )

    # Depois do preenchimento dos registos antigos,
    # operation_key passa a ser obrigatória.
    op.alter_column(
        "payment_references",
        "operation_key",
        existing_type=sa.String(length=80),
        nullable=False,
    )

    op.create_index(
        "ix_payment_references_operation_key",
        "payment_references",
        ["operation_key"],
        unique=True,
    )

    op.create_index(
        "ix_payment_references_creation_status",
        "payment_references",
        ["creation_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_payment_references_creation_status",
        table_name="payment_references",
    )

    op.drop_index(
        "ix_payment_references_operation_key",
        table_name="payment_references",
    )

    # Um downgrade só pode voltar a NOT NULL se não
    # existirem operações incompletas. Removemos esses
    # registos porque o schema antigo não os consegue
    # representar.
    op.execute(
        """
        DELETE FROM payment_references
        WHERE entity IS NULL
           OR reference IS NULL
           OR easypay_id IS NULL
        """
    )

    op.alter_column(
        "payment_references",
        "easypay_id",
        existing_type=sa.String(length=80),
        nullable=False,
    )

    op.alter_column(
        "payment_references",
        "reference",
        existing_type=sa.String(length=50),
        nullable=False,
    )

    op.alter_column(
        "payment_references",
        "entity",
        existing_type=sa.String(length=30),
        nullable=False,
    )

    op.drop_column(
        "payment_references",
        "creation_checked_at",
    )

    op.drop_column(
        "payment_references",
        "creation_error",
    )

    op.drop_column(
        "payment_references",
        "creation_status",
    )

    op.drop_column(
        "payment_references",
        "operation_key",
    )