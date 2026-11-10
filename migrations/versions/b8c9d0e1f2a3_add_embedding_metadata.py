"""add embedding metadata to chunks

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-11-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chunks", sa.Column("embedding_model", sa.String(length=255), nullable=True))
    op.add_column("chunks", sa.Column("embedding_dimension", sa.Integer(), nullable=True))
    op.create_index("ix_chunks_embedding_model", "chunks", ["embedding_model"])


def downgrade() -> None:
    op.drop_index("ix_chunks_embedding_model", table_name="chunks")
    op.drop_column("chunks", "embedding_dimension")
    op.drop_column("chunks", "embedding_model")
