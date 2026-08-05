"""create check_evidence and reports tables

Revision ID: e7903e5fd01d
Revises: 2bb4c4ef678c
Create Date: 2026-07-22 22:37:37.972473

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e7903e5fd01d'
down_revision: Union[str, Sequence[str], None] = '2bb4c4ef678c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'check_evidence',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('reservation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('photo_url', sa.String(), nullable=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['reservation_id'], ['reservations.id']),
        sa.CheckConstraint("type IN ('check_in', 'check_out')", name='ck_check_evidence_type'),
    )

    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('reservation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reported_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('photo_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['reservation_id'], ['reservations.id']),
        sa.ForeignKeyConstraint(['reported_by'], ['users.id']),
        sa.UniqueConstraint('reservation_id', name='uq_reports_reservation_id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('reports')
    op.drop_table('check_evidence')
