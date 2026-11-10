"""add durable document storage metadata

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("storage_key", sa.String(length=1000), nullable=True))
    op.add_column("documents", sa.Column("original_filename", sa.String(length=500), nullable=True))
    op.add_column("documents", sa.Column("content_type", sa.String(length=255), nullable=True))
    op.add_column("documents", sa.Column("file_size_bytes", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("checksum_sha256", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_documents_storage_key", "documents", ["storage_key"])
    op.create_index("ix_documents_checksum_sha256", "documents", ["checksum_sha256"])


def downgrade() -> None:
    op.drop_index("ix_documents_checksum_sha256", table_name="documents")
    op.drop_constraint("uq_documents_storage_key", "documents", type_="unique")
    op.drop_column("documents", "checksum_sha256")
    op.drop_column("documents", "file_size_bytes")
    op.drop_column("documents", "content_type")
    op.drop_column("documents", "original_filename")
    op.drop_column("documents", "storage_key")
