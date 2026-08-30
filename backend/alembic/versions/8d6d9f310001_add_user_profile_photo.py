"""add user profile photo

Revision ID: 8d6d9f310001
Revises: 07f04a1eac3d
Create Date: 2026-08-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8d6d9f310001"
down_revision: Union[str, Sequence[str], None] = "07f04a1eac3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "photo_object_key",
            sa.String(length=500),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "users",
        "photo_object_key",
    )