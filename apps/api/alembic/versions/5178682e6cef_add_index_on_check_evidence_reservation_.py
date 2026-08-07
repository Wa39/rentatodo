"""add index on check_evidence.reservation_id

Revision ID: 5178682e6cef
Revises: e7903e5fd01d
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5178682e6cef'
down_revision: Union[str, Sequence[str], None] = 'e7903e5fd01d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Postgres does not create an index on a foreign key automatically.
    # Every lookup of a reservation's check-in/check-out evidence was a
    # full table scan (audit finding M2, PR #94).
    op.create_index(
        'ix_check_evidence_reservation_id', 'check_evidence', ['reservation_id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_check_evidence_reservation_id', table_name='check_evidence')
