"""create items table

Revision ID: edb3d65c0dce
Revises: be2258948218
Create Date: 2026-07-15 23:41:38.146213

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'edb3d65c0dce'
down_revision = 'be2258948218'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('CREATE EXTENSION IF NOT EXISTS unaccent')
    # unaccent() itself is STABLE, not IMMUTABLE, so Postgres rejects it
    # directly inside a functional index expression (verified live). This
    # thin wrapper is IMMUTABLE and is used both in idx_items_search below
    # and in every search query in app/services/items.py.
    op.execute(
        "CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$ "
        "SELECT unaccent('unaccent', $1) $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT"
    )

    op.create_table(
        'items',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('price_per_day', sa.Integer(), nullable=False),
        sa.Column('photo_url', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.CheckConstraint('price_per_day > 0', name='ck_items_price_per_day_positive'),
    )
    op.create_index(
        'idx_items_category', 'items', ['category'],
        postgresql_where=sa.text('is_active = true'),
    )
    op.execute(
        "CREATE INDEX idx_items_search ON items "
        "USING gin (to_tsvector('simple', immutable_unaccent(name || ' ' || description)))"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_items_search', table_name='items')
    op.drop_index('idx_items_category', table_name='items')
    op.drop_table('items')
    op.execute('DROP FUNCTION IF EXISTS immutable_unaccent(text)')
