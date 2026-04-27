"""add leads.source_query for multi-search sessions

Revision ID: 20260426_0002
Revises: 20260423_0001
Create Date: 2026-04-26
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260426_0002"
down_revision: Union[str, None] = "20260423_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("source_query", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "source_query")
