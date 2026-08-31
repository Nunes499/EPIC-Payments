"""create permanent sms history

Revision ID: 8d6d9f310003
Revises: 8d6d9f310002
Create Date: 2026-08-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8d6d9f310003"
down_revision: Union[str, Sequence[str], None] = "8d6d9f310002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sms_history",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.String(length=50),
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
            "phone",
            sa.String(length=40),
            nullable=False,
        ),
        sa.Column(
            "entity",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "reference",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "value",
            sa.Numeric(
                precision=10,
                scale=2,
            ),
            nullable=False,
        ),
        sa.Column(
            "message_type",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "message",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "sms_id",
            sa.String(length=160),
            nullable=False,
        ),
        sa.Column(
            "sent_by_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "sent_by_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["sent_by_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_sms_history_id"),
        "sms_history",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sms_history_source"),
        "sms_history",
        ["source"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sms_history_sent_by_id"),
        "sms_history",
        ["sent_by_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sms_history_sent_at"),
        "sms_history",
        ["sent_at"],
        unique=False,
    )
    op.create_index(
        "ix_sms_history_source_sent_at",
        "sms_history",
        ["source", "sent_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sms_history_source_sent_at",
        table_name="sms_history",
    )
    op.drop_index(
        op.f("ix_sms_history_sent_at"),
        table_name="sms_history",
    )
    op.drop_index(
        op.f("ix_sms_history_sent_by_id"),
        table_name="sms_history",
    )
    op.drop_index(
        op.f("ix_sms_history_source"),
        table_name="sms_history",
    )
    op.drop_index(
        op.f("ix_sms_history_id"),
        table_name="sms_history",
    )
    op.drop_table("sms_history")
