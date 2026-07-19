"""create reservations and transactions tables

Revision ID: 2bb4c4ef678c
Revises: edb3d65c0dce
Create Date: 2026-07-17 18:38:55.354899

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2bb4c4ef678c'
down_revision = 'edb3d65c0dce'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist')

    op.create_table(
        'reservations',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('renter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'requested'"), nullable=False),
        sa.Column('deposit_amount', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id']),
        sa.ForeignKeyConstraint(['renter_id'], ['users.id']),
        sa.CheckConstraint('end_date >= start_date', name='ck_reservations_end_after_start'),
    )
    op.create_index(
        'idx_reservations_item', 'reservations', ['item_id', 'start_date', 'end_date'],
        postgresql_where=sa.text("status NOT IN ('rejected', 'cancelled', 'closed')"),
    )
    op.create_index('idx_reservations_renter', 'reservations', ['renter_id'])
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT no_double_booking "
        "EXCLUDE USING gist ("
        "  item_id WITH =, "
        "  daterange(start_date, end_date, '[]') WITH &&"
        ") WHERE (status NOT IN ('rejected', 'cancelled', 'closed'))"
    )

    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('reservation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['reservation_id'], ['reservations.id']),
        sa.CheckConstraint("type IN ('hold', 'release', 'freeze')", name='ck_transactions_type'),
    )
    op.create_index('idx_transactions_reservation', 'transactions', ['reservation_id', 'created_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_transactions_reservation', table_name='transactions')
    op.drop_table('transactions')
    op.execute('ALTER TABLE reservations DROP CONSTRAINT no_double_booking')
    op.drop_index('idx_reservations_renter', table_name='reservations')
    op.drop_index('idx_reservations_item', table_name='reservations')
    op.drop_table('reservations')
