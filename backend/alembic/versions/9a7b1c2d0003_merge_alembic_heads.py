"""merge alembic heads

Revision ID: 9a7b1c2d0003
Revises: 40440db9636b, 9a7b1c2d0002
Create Date: 2026-09-15
"""

from typing import Sequence, Union


revision: str = "9a7b1c2d0003"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = (
    "40440db9636b",
    "9a7b1c2d0002",
)

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
    pass


def downgrade() -> None:
    pass