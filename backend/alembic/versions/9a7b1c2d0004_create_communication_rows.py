"""create communication rows

Revision ID: 9a7b1c2d0004
Revises: 9a7b1c2d0003
Create Date: 2026-09-16

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a7b1c2d0004"
down_revision: Union[str, None] = "9a7b1c2d0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "communication_rows",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "source_file_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "source_file_key",
            sa.String(length=500),
            nullable=False,
        ),
        sa.Column(
            "sequence",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "member_number",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "member_name",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "age",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "phone",
            sa.String(length=40),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "reason",
            sa.String(length=500),
            nullable=False,
        ),
        sa.Column(
            "payment_reference_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "sms_history_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "updated_by_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["payment_reference_id"],
            ["payment_references.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sms_history_id"],
            ["sms_history.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_file_key",
            "sequence",
            name=(
                "uq_communication_rows_"
                "file_key_sequence"
            ),
        ),
    )

    op.create_index(
        op.f("ix_communication_rows_id"),
        "communication_rows",
        ["id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_source_file_id"),
        "communication_rows",
        ["source_file_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_source_file_key"),
        "communication_rows",
        ["source_file_key"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_member_number"),
        "communication_rows",
        ["member_number"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_payment_reference_id"),
        "communication_rows",
        ["payment_reference_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_sms_history_id"),
        "communication_rows",
        ["sms_history_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_updated_by_id"),
        "communication_rows",
        ["updated_by_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_created_at"),
        "communication_rows",
        ["created_at"],
        unique=False,
    )

    op.create_index(
        op.f("ix_communication_rows_updated_at"),
        "communication_rows",
        ["updated_at"],
        unique=False,
    )

    op.create_index(
        "ix_communication_rows_file_id_sequence",
        "communication_rows",
        [
            "source_file_id",
            "sequence",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_communication_rows_file_id_sequence",
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_updated_at"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_created_at"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_updated_by_id"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_sms_history_id"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_payment_reference_id"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_member_number"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_source_file_key"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_source_file_id"),
        table_name="communication_rows",
    )

    op.drop_index(
        op.f("ix_communication_rows_id"),
        table_name="communication_rows",
    )

    op.drop_table(
        "communication_rows",
    )