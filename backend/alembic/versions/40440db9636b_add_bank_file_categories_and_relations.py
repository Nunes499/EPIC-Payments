"""add bank file categories and relations

Revision ID: 40440db9636b
Revises: 01c5b441cd24
Create Date: 2026-08-26 14:01:30.667878

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "40440db9636b"
down_revision: Union[str, Sequence[str], None] = "01c5b441cd24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "calendar_files",
        sa.Column(
            "file_category",
            sa.String(length=20),
            nullable=False,
            server_default="normal",
        ),
    )

    op.add_column(
        "calendar_files",
        sa.Column(
            "recovery_part",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "calendar_files",
        sa.Column(
            "related_file_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_calendar_files_file_category",
        "calendar_files",
        ["file_category"],
        unique=False,
    )

    op.create_index(
        "ix_calendar_files_related_file_id",
        "calendar_files",
        ["related_file_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_calendar_files_related_file_id",
        "calendar_files",
        "calendar_files",
        ["related_file_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_calendar_files_related_file_id",
        "calendar_files",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_calendar_files_related_file_id",
        table_name="calendar_files",
    )

    op.drop_index(
        "ix_calendar_files_file_category",
        table_name="calendar_files",
    )

    op.drop_column(
        "calendar_files",
        "related_file_id",
    )

    op.drop_column(
        "calendar_files",
        "recovery_part",
    )

    op.drop_column(
        "calendar_files",
        "file_category",
    )