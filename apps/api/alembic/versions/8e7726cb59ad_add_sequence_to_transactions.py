"""add sequence to transactions

Revision ID: 8e7726cb59ad
Revises: 5178682e6cef
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e7726cb59ad'
down_revision: Union[str, Sequence[str], None] = '5178682e6cef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # created_at reflects the enclosing transaction's start time
    # (Postgres now()), not statement execution time — two separate
    # Transaction inserts can land on the exact same created_at, which
    # made "latest transaction" ordering (Reservation.deposit_status,
    # and anything derived from it) ambiguous. sequence is a real
    # Postgres identity column: monotonic and unique regardless of
    # timing. Existing rows get backfilled by Postgres in physical
    # storage order when the column is added — acceptable here since
    # this repo's only pre-existing transactions rows are dev/seed data.
    op.add_column(
        'transactions',
        sa.Column('sequence', sa.BigInteger(), sa.Identity(always=True), nullable=False),
    )
    op.create_unique_constraint('uq_transactions_sequence', 'transactions', ['sequence'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_transactions_sequence', 'transactions', type_='unique')
    op.drop_column('transactions', 'sequence')
