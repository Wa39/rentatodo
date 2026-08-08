"""exclude returned reservations from double booking constraint

Revision ID: e51457c9bb90
Revises: 8e7726cb59ad
Create Date: 2026-08-08 13:15:18.437551

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e51457c9bb90'
down_revision: Union[str, Sequence[str], None] = '8e7726cb59ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # no_double_booking's WHERE clause is a hardcoded mirror of
    # BLOCKING_STATUSES (app/models/reservation.py) at the DB level — the
    # app-side overlap check and this EXCLUDE constraint must agree on which
    # statuses count as "blocking", or a request that passes the app check
    # still fails with an unhandled IntegrityError on commit.
    #
    # "returned" now moves off that list: once the renter checks out, the
    # item is physically back with the owner, so its dates must free up for
    # a new booking immediately — "returned" only matters to the deposit/
    # closing workflow (close_reservation), not to physical availability.
    op.execute('ALTER TABLE reservations DROP CONSTRAINT no_double_booking')
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT no_double_booking "
        "EXCLUDE USING gist ("
        "  item_id WITH =, "
        "  daterange(start_date, end_date, '[]') WITH &&"
        ") WHERE (status NOT IN ('rejected', 'cancelled', 'closed', 'returned'))"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('ALTER TABLE reservations DROP CONSTRAINT no_double_booking')
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT no_double_booking "
        "EXCLUDE USING gist ("
        "  item_id WITH =, "
        "  daterange(start_date, end_date, '[]') WITH &&"
        ") WHERE (status NOT IN ('rejected', 'cancelled', 'closed'))"
    )
