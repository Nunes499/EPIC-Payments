"""rename reception role to collaborator

Revision ID: 8d6d9f310002
Revises: 8d6d9f310001
Create Date: 2026-08-30
"""

from typing import Sequence, Union

from alembic import op


revision: str = "8d6d9f310002"
down_revision: Union[str, Sequence[str], None] = "8d6d9f310001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users "
        "SET role = 'collaborator' "
        "WHERE role = 'reception'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE users "
        "SET role = 'reception' "
        "WHERE role = 'collaborator'"
    )