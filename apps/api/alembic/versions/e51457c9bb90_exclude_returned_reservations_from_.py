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


def _recreate_no_double_booking(excluded_statuses: str) -> None:
    """Drop and re-add no_double_booking with the given WHERE clause.

    Written once so upgrade()/downgrade() can never state the constraint's
    unchanging parts (columns, index type) differently from each other —
    only the status list they pass in can differ.

    Args:
        excluded_statuses: The raw SQL fragment for the WHERE clause's
            NOT IN (...) list, e.g. "'rejected', 'cancelled', 'closed'".
    """
    op.execute('ALTER TABLE reservations DROP CONSTRAINT no_double_booking')
    op.execute(
        "ALTER TABLE reservations ADD CONSTRAINT no_double_booking "
        "EXCLUDE USING gist ("
        "  item_id WITH =, "
        "  daterange(start_date, end_date, '[]') WITH &&"
        f") WHERE (status NOT IN ({excluded_statuses}))"
    )


def upgrade() -> None:
    """Upgrade schema."""
    # no_double_booking's WHERE clause is a hardcoded mirror of
    # BLOCKING_STATUSES (app/models/reservation.py) at the DB level — the
    # app-side overlap check and this EXCLUDE constraint must agree on which
    # statuses count as "blocking", or a request that passes the app check
    # still fails with an unhandled IntegrityError on commit. A test
    # (tests/models/test_reservation.py::test_no_double_booking_constraint_matches_blocking_statuses)
    # reads this constraint's live definition back out of Postgres and
    # compares it against BLOCKING_STATUSES, so the two drifting apart
    # fails a test instead of surfacing in production.
    #
    # "returned" now moves off that list: once the renter checks out, the
    # item is physically back with the owner, so its dates must free up for
    # a new booking immediately — "returned" only matters to the deposit/
    # closing workflow (close_reservation), not to physical availability.
    _recreate_no_double_booking("'rejected', 'cancelled', 'closed', 'returned'")


def downgrade() -> None:
    """Downgrade schema.

    NOTE: this is a one-way trip once upgrade() has been live and used.
    Re-adding the stricter constraint (blocking on "returned" again) does
    not reconcile existing data first — if a reservation was legitimately
    created overlapping an already-"returned" one on the same item (exactly
    what upgrade() allows), this ADD CONSTRAINT fails with a Postgres error,
    because those rows now violate the constraint being re-added. Rolling
    back this migration on a database that has only ever run under the old
    (pre-upgrade) constraint is safe; rolling it back after real traffic has
    exercised the new, looser rule is not guaranteed to succeed.
    """
    _recreate_no_double_booking("'rejected', 'cancelled', 'closed'")
