"""create payment references

Revision ID: 9a7b1c2d0001
Revises: 8d6d9f310003
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9a7b1c2d0001"
down_revision: Union[
    str,
    Sequence[str],
    None,
] = "8d6d9f310003"
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
    op.create_table(
        "payment_references",
        sa.Column(
            "id",
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
            "value",
            sa.Numeric(
                precision=10,
                scale=2,
            ),
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
            "easypay_id",
            sa.String(length=80),
            nullable=False,
        ),
        sa.Column(
            "payment_status",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_by_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_by_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "reference",
        ),
        sa.UniqueConstraint(
            "easypay_id",
        ),
    )

    op.create_index(
        op.f(
            "ix_payment_references_id"
        ),
        "payment_references",
        ["id"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_member_number"
        ),
        "payment_references",
        ["member_number"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_member_name"
        ),
        "payment_references",
        ["member_name"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_reference"
        ),
        "payment_references",
        ["reference"],
        unique=True,
    )

    op.create_index(
        op.f(
            "ix_payment_references_easypay_id"
        ),
        "payment_references",
        ["easypay_id"],
        unique=True,
    )

    op.create_index(
        op.f(
            "ix_payment_references_payment_status"
        ),
        "payment_references",
        ["payment_status"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_expires_at"
        ),
        "payment_references",
        ["expires_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_paid_at"
        ),
        "payment_references",
        ["paid_at"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_created_by_id"
        ),
        "payment_references",
        ["created_by_id"],
        unique=False,
    )

    op.create_index(
        op.f(
            "ix_payment_references_created_at"
        ),
        "payment_references",
        ["created_at"],
        unique=False,
    )

    op.create_index(
        "ix_payment_references_status_created_at",
        "payment_references",
        [
            "payment_status",
            "created_at",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_payment_references_status_created_at",
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_created_at"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_created_by_id"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_paid_at"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_expires_at"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_payment_status"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_easypay_id"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_reference"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_member_name"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_member_number"
        ),
        table_name="payment_references",
    )

    op.drop_index(
        op.f(
            "ix_payment_references_id"
        ),
        table_name="payment_references",
    )

    op.drop_table(
        "payment_references"
    )
