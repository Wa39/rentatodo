# Reservations (Week 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 6 `CLAUDE_BACKEND.md` "Week 2" endpoints (request/list/approve/reject/cancel a reservation) plus wiring `GET /items`'s `available_from`/`available_to` filters and `GET /items/{item_id}`'s `unavailable_dates` to real data.

**Architecture:** Same layered pattern as Auth/Items — `routers/reservations.py` (HTTP) → `services/reservations.py` (business logic, double-booking prevention) → `models/reservation.py` (`Reservation`, `Transaction`, SQLAlchemy) — reusing the existing `AppError`, `get_current_user`, `RequestValidationError` handler, and `db_session`/`client`/`make_user`/`make_item` fixtures. Double-booking prevention is two layers: an application-level `SELECT ... FOR UPDATE` lock plus a database-level `EXCLUDE` constraint (`btree_gist`). `services/items.py` gains a one-directional dependency on `app.models.reservation` for the availability wiring.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, pytest, PostgreSQL 16 (`btree_gist` extension).

**Source of truth:** `docs/superpowers/specs/2026-07-17-reservations-design.md`.

## Global Constraints

- Scope is exactly 6 endpoints: `POST /items/{item_id}/reservations`, `GET /users/me/reservations`, `GET /users/me/requests`, `PATCH /reservations/{id}/approve`, `PATCH /reservations/{id}/reject`, `PATCH /reservations/{id}/cancel` — plus the `GET /items` / `GET /items/{item_id}` availability wiring. No check-in/out, close, report, transactions-history, or earnings endpoints in this plan — `CLAUDE_BACKEND.md`'s Weeks 3-4.
- `renter_id`/`owner_id` for authorization are always read from `get_current_user`'s token (JWT), never from the request body or path — same rule as Items.
- Check order is always existence (404) → ownership/role (403) → state (409) → payload validity where relevant, matching the precedent in `update_item`/`delete_item`.
- All errors use `AppError(status_code, code, message)` → `{"error": {"code": ..., "message": ...}}`.
- `BLOCKING_STATUSES = ("requested", "approved", "delivered", "returned")` lives in `app/models/reservation.py` (not in a services module) so both `services/reservations.py` and `services/items.py` can import it without a services-to-services dependency. These are the statuses that count for double-booking prevention, `unavailable_dates`, and the `available_from`/`available_to` filter — everything except `rejected`/`cancelled`/`closed`.
- `deposit_amount = item.price_per_day * ((end_date - start_date).days + 1)` — inclusive day count. A 1-day rental has `end_date == start_date` and counts as 1 day, matching `start_date`/`end_date` being documented as "First day"/"Last day of rental" (both rental days) and the `EXCLUDE` constraint's inclusive `daterange(start_date, end_date, '[]')`.
- `deposit_status` (`none`/`held`/`released`/`frozen`) is always derived live from the latest `Transaction` row (`Reservation.deposit_status` property) — never cached/denormalized onto `Reservation`, per `CLAUDE_BACKEND.md`'s "SACRED RULE". List endpoints avoid N+1 via `selectinload(Reservation.transactions)`, not a per-row query.
- `CANNOT_RENT_OWN_ITEM` is raised as `422`, not `403` — the merged `packages/contracts/openapi.yaml` maps this case to a generic `422` (line 818), and `ROADMAP.md`'s 2026-07-17 decision is to use the specific error code at the contract's current status so mobile (which branches on `error.code`, confirmed by Zero) needs no changes if the status code is bumped to `403` later.
- The `no_double_booking` `EXCLUDE` constraint (see Task 1) is implemented via raw SQL in the Alembic migration (`op.execute`), the same pattern already used for `immutable_unaccent` in `edb3d65c0dce_create_items_table.py` — it is intentionally NOT modeled in `Reservation.__table_args__`, since this project builds migrations by hand rather than via `alembic revision --autogenerate`, so the ORM metadata doesn't need to represent it for the schema to be correct.
- No real-concurrency/threaded test for the double-booking lock — verified via a sequential-request test (application layer) and a direct-`INSERT` test (database layer), plus manual live verification against a running `uvicorn` server, documented in the roadmap as evidence, same as the MiniStack S3 check. Decided in brainstorming.
- This branch (`feature/reservations`) was cut from `develop`, which does **not** yet include `PATCH`/`DELETE /items/{id}`/`GET /users/me/items` (those are on the still-unmerged `feature/items-followup`, PR #24) — so `app/routers/items.py`/`app/services/items.py` in this plan's Task 7 start from the 3-endpoint version (`POST /items`, `GET /items`, `GET /items/{item_id}`), not the 6-endpoint one.
- Tests live under `tests/`, mirroring `app/`'s structure. Each piece of business logic gets a happy-path test and a test for its most likely failure. Baseline before this plan: **65 passing tests**.
- Commit convention: `type(api): description`.
- **Prerequisite for every task with a Test step:** the local Postgres container must be running: `cd apps/api && docker compose up -d db`. All commands assume the working directory is `apps/api` and the virtualenv is at `apps/api/venv` (Windows layout: `venv/Scripts/python.exe`).

---

### Task 1: `Reservation` and `Transaction` models, and their migration

**Files:**
- Create: `apps/api/app/models/reservation.py`
- Modify: `apps/api/app/models/__init__.py`
- Create: `apps/api/alembic/versions/<new>_create_reservations_and_transactions_tables.py`
- Test: `apps/api/tests/models/test_reservation.py`

**Interfaces:**
- Consumes: `app.database.Base`, `app.models.item.Item`, `app.models.user.User`, `tests/conftest.py`'s `db_session`/`make_user`/`make_item`.
- Produces: `app.models.reservation.BLOCKING_STATUSES` (tuple of 4 strings), `app.models.reservation.Reservation` (`.id`, `.item_id`, `.renter_id`, `.start_date`, `.end_date`, `.status: str`, `.deposit_amount: int`, `.created_at`, `.updated_at`, `.item: Item`, `.renter: User`, `.transactions: list[Transaction]`, `.item_name: str`, `.item_photo_url: str`, `.renter_name: str`, `.deposit_status: str` property), `app.models.reservation.Transaction` (`.id`, `.reservation_id`, `.type: str`, `.amount: int`, `.created_at`, `.reservation: Reservation`) — every later task imports these. The `no_double_booking` `EXCLUDE` constraint on `reservations` — used by Task 3's tests and application logic.

- [ ] **Step 1: Create `app/models/reservation.py`**

```python
"""SQLAlchemy models for the `reservations` and `transactions` tables."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.item import Item
from app.models.user import User

BLOCKING_STATUSES = ("requested", "approved", "delivered", "returned")
"""Reservation statuses that count as "active" for double-booking
prevention and item-availability purposes — everything except
rejected/cancelled/closed. Matches the WHERE clause on the
no_double_booking EXCLUDE constraint and idx_reservations_item.
"""


class Reservation(Base):
    """A rental request/booking for an Item, moving through a status
    state machine (see CLAUDE_BACKEND.md). Deposit state is derived
    from the latest Transaction row, never cached here.

    Attributes:
        id: Primary key, generated by Postgres.
        item_id: The rented Item's id.
        renter_id: The requesting User's id. The owner is derived via
            item.owner_id — never denormalized onto this table.
        start_date: First day of the rental (inclusive).
        end_date: Last day of the rental (inclusive).
        status: One of requested/approved/delivered/returned/closed/rejected/cancelled.
        deposit_amount: price_per_day * inclusive day count, in centavos.
        created_at: When the reservation was requested.
        updated_at: Updated on every status transition.
        item: The rented Item, via relationship.
        renter: The requesting User, via relationship.
        transactions: This reservation's Transaction history, oldest
            first — use .deposit_status to read the derived state
            instead of touching this list directly.
    """

    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_reservations_end_after_start"),
        Index(
            "idx_reservations_item",
            "item_id",
            "start_date",
            "end_date",
            postgresql_where=text("status NOT IN ('rejected', 'cancelled', 'closed')"),
        ),
        Index("idx_reservations_renter", "renter_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    renter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'requested'")
    )
    deposit_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    item: Mapped[Item] = relationship()
    renter: Mapped[User] = relationship()
    transactions: Mapped[list["Transaction"]] = relationship(
        order_by="Transaction.created_at", back_populates="reservation"
    )

    @property
    def item_name(self) -> str:
        """The rented item's name, via the item relationship."""
        return self.item.name

    @property
    def item_photo_url(self) -> str:
        """The rented item's photo URL, via the item relationship."""
        return self.item.photo_url

    @property
    def renter_name(self) -> str:
        """The renter's display name, via the renter relationship."""
        return self.renter.name

    @property
    def deposit_status(self) -> str:
        """The deposit's current state, derived from the latest
        Transaction — never cached, per CLAUDE_BACKEND.md's "SACRED
        RULE" that the transactions table is the sole source of truth.

        Returns:
            "none" if no transaction exists yet, otherwise the status
            implied by the most recent transaction's type (hold ->
            held, release -> released, freeze -> frozen).
        """
        if not self.transactions:
            return "none"
        latest = self.transactions[-1]
        return {"hold": "held", "release": "released", "freeze": "frozen"}[latest.type]


class Transaction(Base):
    """An immutable deposit-ledger entry for a Reservation. INSERT only
    — nothing in this codebase ever updates or deletes a Transaction row.

    Attributes:
        id: Primary key, generated by Postgres.
        reservation_id: The Reservation this entry belongs to.
        type: One of hold/release/freeze.
        amount: In USD centavos.
        created_at: When this entry was recorded.
        reservation: The owning Reservation, via relationship.
    """

    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("type IN ('hold', 'release', 'freeze')", name="ck_transactions_type"),
        Index("idx_transactions_reservation", "reservation_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reservations.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    reservation: Mapped[Reservation] = relationship(back_populates="transactions")
```

- [ ] **Step 2: Register both models in `app/models/__init__.py`**

Replace the entire file contents with:

```python
from app.models.item import Item
from app.models.reservation import BLOCKING_STATUSES, Reservation, Transaction
from app.models.user import User

__all__ = ["BLOCKING_STATUSES", "Item", "Reservation", "Transaction", "User"]
```

- [ ] **Step 3: Write the failing tests**

Create `apps/api/tests/models/test_reservation.py`:

```python
"""Tests for the Reservation and Transaction models and their
database-level constraints.
"""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.reservation import Reservation, Transaction


def test_reservation_gets_id_created_at_updated_at_and_default_status(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a Reservation inserted without setting id/timestamps/
    status still gets sensible values from Postgres.
    """
    owner = make_user(email="resmodel-owner1@example.com")
    renter = make_user(email="resmodel-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.id is not None
    assert reservation.created_at is not None
    assert reservation.updated_at is not None
    assert reservation.status == "requested"


def test_end_date_must_be_on_or_after_start_date(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: the end_date >= start_date CHECK is enforced by
    Postgres, not only by application code.
    """
    owner = make_user(email="resmodel-owner2@example.com")
    renter = make_user(email="resmodel-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 5),
        deposit_amount=15000,
    )
    db_session.add(reservation)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_no_double_booking_constraint_blocks_direct_overlapping_insert(
    db_session: Session, make_user, make_item
) -> None:
    """The migration's EXCLUDE constraint is a second, database-level
    layer — this bypasses any application code entirely to prove
    Postgres itself rejects an overlap.
    """
    owner = make_user(email="resmodel-owner3@example.com")
    renter = make_user(email="resmodel-renter3@example.com")
    item = make_item(owner_id=owner.id)
    first = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 5),
        deposit_amount=25000,
    )
    db_session.add(first)
    db_session.commit()

    second = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 9, 3),
        end_date=date(2026, 9, 7),
        deposit_amount=25000,
    )
    db_session.add(second)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_double_booking_constraint_ignores_rejected_reservations(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: a "rejected" reservation doesn't block a new one on
    overlapping dates — the constraint's WHERE clause excludes
    rejected/cancelled/closed.
    """
    owner = make_user(email="resmodel-owner4@example.com")
    renter = make_user(email="resmodel-renter4@example.com")
    item = make_item(owner_id=owner.id)
    rejected = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 5),
        status="rejected",
        deposit_amount=25000,
    )
    db_session.add(rejected)
    db_session.commit()

    new = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 10, 2),
        end_date=date(2026, 10, 4),
        deposit_amount=25000,
    )
    db_session.add(new)
    db_session.commit()
    db_session.refresh(new)

    assert new.id is not None


def test_transaction_type_must_be_a_valid_value(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: the type CHECK constraint rejects anything outside
    hold/release/freeze.
    """
    owner = make_user(email="resmodel-owner5@example.com")
    renter = make_user(email="resmodel-renter5@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    transaction = Transaction(reservation_id=reservation.id, type="not-a-real-type", amount=15000)
    db_session.add(transaction)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_deposit_status_is_none_without_any_transaction(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a fresh reservation with no Transaction rows has
    deposit_status "none".
    """
    owner = make_user(email="resmodel-owner6@example.com")
    renter = make_user(email="resmodel-renter6@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 3),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.deposit_status == "none"


def test_deposit_status_reflects_the_latest_transaction(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: after a hold then a release, deposit_status is
    "released", not "held" — proves it reads the latest row, not just
    any row.
    """
    owner = make_user(email="resmodel-owner7@example.com")
    renter = make_user(email="resmodel-renter7@example.com")
    item = make_item(owner_id=owner.id)
    reservation = Reservation(
        item_id=item.id,
        renter_id=renter.id,
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 12),
        deposit_amount=15000,
    )
    db_session.add(reservation)
    db_session.commit()

    db_session.add(Transaction(reservation_id=reservation.id, type="hold", amount=15000))
    db_session.commit()
    db_session.refresh(reservation)
    assert reservation.deposit_status == "held"

    db_session.add(Transaction(reservation_id=reservation.id, type="release", amount=15000))
    db_session.commit()
    db_session.refresh(reservation)

    assert reservation.deposit_status == "released"
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/models/test_reservation.py -v`
Expected: FAIL — `sqlalchemy.exc.ProgrammingError: relation "reservations" does not exist`.

- [ ] **Step 5: Create the migration file**

Run: `cd apps/api && venv/Scripts/python.exe -m alembic revision -m "create reservations and transactions tables"`
Expected: a new file appears at `alembic/versions/<hash>_create_reservations_and_transactions_tables.py`.

- [ ] **Step 6: Replace the generated file's contents**

Open the new file. Keep its auto-generated `revision` id and `Create Date`, but set `down_revision = 'edb3d65c0dce'` (the `create items table` migration — the current head on this branch, since `feature/reservations` was cut from `develop`, which doesn't include PR #24's not-yet-merged migrations). Replace the full file contents with:

```python
"""create reservations and transactions tables

Revision ID: <keep the generated value>
Revises: edb3d65c0dce
Create Date: <keep the generated value>

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '<keep the generated value>'
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
```

- [ ] **Step 7: Apply the migration**

Run: `cd apps/api && venv/Scripts/python.exe -m alembic upgrade head`
Expected: output ending in `... -> <hash>, create reservations and transactions tables`, no errors.

- [ ] **Step 8: Run the tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/models/test_reservation.py -v`
Expected: `7 passed`.

- [ ] **Step 9: Commit**

```bash
git add app/models/reservation.py app/models/__init__.py alembic/versions/*_create_reservations_and_transactions_tables.py tests/models/test_reservation.py
git commit -m "feat(api): add Reservation and Transaction models, migration with double-booking EXCLUDE constraint"
```

---

### Task 2: Reservation Pydantic schemas

**Files:**
- Create: `apps/api/app/schemas/reservation.py`
- Test: `apps/api/tests/schemas/test_reservation.py`

**Interfaces:**
- Consumes: `app.models.reservation.Reservation`.
- Produces: `ReservationStatusEnum` (str Enum, 7 values), `DepositStatusEnum` (str Enum: `none`/`held`/`released`/`frozen`), `CreateReservationRequest` (`start_date`, `end_date`, both required `date`), `ReservationResponse`, `ReservationListResponse` — used by Task 3 (`CreateReservationRequest`) and Task 6's router (all of them).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/schemas/test_reservation.py`:

```python
"""Tests for the Reservation Pydantic schemas."""

from datetime import date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.item import Item
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import CreateReservationRequest, ReservationResponse


def test_create_reservation_request_accepts_valid_dates() -> None:
    """Happy path: a well-formed start/end date pair is accepted as-is."""
    request = CreateReservationRequest(start_date=date(2026, 8, 1), end_date=date(2026, 8, 3))

    assert request.start_date == date(2026, 8, 1)
    assert request.end_date == date(2026, 8, 3)


def test_create_reservation_request_rejects_missing_start_date() -> None:
    """Failure path: start_date is required."""
    with pytest.raises(ValidationError):
        CreateReservationRequest(end_date=date(2026, 8, 3))


def test_reservation_response_builds_from_a_reservation_model_including_derived_fields() -> None:
    """Happy path: item_name/item_photo_url/renter_name/deposit_status
    all resolve via relationships/property, without a separate query.
    """
    owner = User(name="Ana Duena", email="ana@example.com", password_hash="hashed")
    item = Item(
        id=uuid4(),
        owner_id=uuid4(),
        name="Taladro Bosch",
        description="Percutor profesional",
        category="tools",
        price_per_day=5000,
        photo_url="https://example.com/photo.jpg",
    )
    item.owner = owner
    renter = User(name="Carlos Renter", email="carlos@example.com", password_hash="hashed")
    now = datetime.now()
    reservation = Reservation(
        id=uuid4(),
        item_id=item.id,
        renter_id=uuid4(),
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 3),
        status="requested",
        deposit_amount=15000,
        created_at=now,
        updated_at=now,
    )
    reservation.item = item
    reservation.renter = renter

    response = ReservationResponse.model_validate(reservation)

    assert response.item_name == "Taladro Bosch"
    assert response.renter_name == "Carlos Renter"
    assert response.deposit_status == "none"
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/schemas/test_reservation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.reservation'`.

- [ ] **Step 3: Create `app/schemas/reservation.py`**

```python
"""Pydantic schemas for the Reservations endpoints. Mirrors
packages/contracts/openapi.yaml exactly.
"""

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReservationStatusEnum(str, Enum):
    """The reservation state machine's 7 possible statuses."""

    REQUESTED = "requested"
    APPROVED = "approved"
    DELIVERED = "delivered"
    RETURNED = "returned"
    CLOSED = "closed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DepositStatusEnum(str, Enum):
    """Derived from the latest Transaction for a reservation."""

    NONE = "none"
    HELD = "held"
    RELEASED = "released"
    FROZEN = "frozen"


class CreateReservationRequest(BaseModel):
    """Payload for POST /items/{item_id}/reservations."""

    start_date: date = Field(..., description="First day of rental. Must be today or future.")
    end_date: date = Field(..., description="Last day of rental. Must be >= start_date.")


class ReservationResponse(BaseModel):
    """Public reservation representation, as returned by every
    Reservations endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_id: UUID
    item_name: str
    item_photo_url: str
    renter_id: UUID
    renter_name: str
    start_date: date
    end_date: date
    status: ReservationStatusEnum
    deposit_amount: int
    deposit_status: DepositStatusEnum
    created_at: datetime
    updated_at: datetime


class ReservationListResponse(BaseModel):
    """Paginated response for GET /users/me/reservations and
    GET /users/me/requests.
    """

    reservations: list[ReservationResponse]
    page: int
    limit: int
    total: int
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/schemas/test_reservation.py -v`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/schemas/reservation.py tests/schemas/test_reservation.py
git commit -m "feat(api): add Reservation Pydantic schemas"
```

---

### Task 3: `create_reservation` service function

**Files:**
- Create: `apps/api/app/services/reservations.py`
- Test: `apps/api/tests/services/test_reservations.py`

**Interfaces:**
- Consumes: `app.models.reservation.Reservation`, `app.models.reservation.BLOCKING_STATUSES`, `app.models.item.Item`, `app.schemas.reservation.CreateReservationRequest`, `app.exceptions.AppError`, `tests/conftest.py`'s `make_user`/`make_item`.
- Produces: `create_reservation(db, item_id: uuid.UUID, renter_id: uuid.UUID, data: CreateReservationRequest) -> Reservation` (raises `AppError`) — used by Task 6's router and Task 4/5's tests (to set up reservations).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/services/test_reservations.py`:

```python
"""Tests for app.services.reservations: create_reservation."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.schemas.reservation import CreateReservationRequest


def _dates(start_offset: int, days: int) -> CreateReservationRequest:
    """Build a CreateReservationRequest starting `start_offset` days from
    today, spanning `days` inclusive days.
    """
    start = date.today() + timedelta(days=start_offset)
    end = start + timedelta(days=days - 1)
    return CreateReservationRequest(start_date=start, end_date=end)


def test_create_reservation_happy_path_computes_deposit(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a 3-day reservation costs price_per_day * 3."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res1@example.com")
    renter = make_user(email="renter-res1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)

    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    assert reservation.status == "requested"
    assert reservation.deposit_amount == 15000


def test_create_reservation_rejects_past_start_date(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: start_date before today is 422 VALIDATION_ERROR."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res2@example.com")
    renter = make_user(email="renter-res2@example.com")
    item = make_item(owner_id=owner.id)
    data = CreateReservationRequest(
        start_date=date.today() - timedelta(days=1), end_date=date.today()
    )

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "VALIDATION_ERROR"


def test_create_reservation_rejects_end_before_start(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: end_date < start_date is 422 VALIDATION_ERROR."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res3@example.com")
    renter = make_user(email="renter-res3@example.com")
    item = make_item(owner_id=owner.id)
    tomorrow = date.today() + timedelta(days=1)
    data = CreateReservationRequest(start_date=tomorrow, end_date=date.today())

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "VALIDATION_ERROR"


def test_create_reservation_rejects_own_item(db_session: Session, make_user, make_item) -> None:
    """Failure path: an owner can't rent their own item."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res4@example.com")
    item = make_item(owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=owner.id, data=_dates(5, 2))

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "CANNOT_RENT_OWN_ITEM"


def test_create_reservation_raises_not_found_for_missing_item(
    db_session: Session, make_user
) -> None:
    """Failure path: a random item id is 404 NOT_FOUND."""
    from app.services.reservations import create_reservation

    renter = make_user(email="renter-res5@example.com")

    with pytest.raises(AppError) as exc_info:
        create_reservation(
            db_session, item_id=uuid.uuid4(), renter_id=renter.id, data=_dates(5, 2)
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_create_reservation_raises_not_found_for_inactive_item(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: an inactive item can't be reserved."""
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res6@example.com")
    renter = make_user(email="renter-res6@example.com")
    item = make_item(owner_id=owner.id, is_active=False)

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2))

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_create_reservation_rejects_exact_duplicate(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: same renter+item+dates, already "requested", is
    409 DUPLICATE_RESERVATION, not a generic overlap conflict.
    """
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res7@example.com")
    renter = make_user(email="renter-res7@example.com")
    item = make_item(owner_id=owner.id)
    data = _dates(10, 3)
    create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter.id, data=data)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "DUPLICATE_RESERVATION"


def test_create_reservation_rejects_overlapping_dates_from_a_different_renter(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a second renter can't book overlapping dates on the
    same item.
    """
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res8@example.com")
    renter1 = make_user(email="renter-res8a@example.com")
    renter2 = make_user(email="renter-res8b@example.com")
    item = make_item(owner_id=owner.id)
    create_reservation(db_session, item_id=item.id, renter_id=renter1.id, data=_dates(20, 5))

    with pytest.raises(AppError) as exc_info:
        create_reservation(db_session, item_id=item.id, renter_id=renter2.id, data=_dates(22, 3))

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "DATES_UNAVAILABLE"


def test_create_reservation_allows_back_to_back_non_overlapping_dates(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: a reservation starting the day after another ends is
    NOT an overlap — both ranges are inclusive but adjacent, not shared.
    """
    from app.services.reservations import create_reservation

    owner = make_user(email="owner-res9@example.com")
    renter1 = make_user(email="renter-res9a@example.com")
    renter2 = make_user(email="renter-res9b@example.com")
    item = make_item(owner_id=owner.id)
    first_start_offset, first_days = 30, 3
    first = create_reservation(
        db_session, item_id=item.id, renter_id=renter1.id,
        data=_dates(first_start_offset, first_days),
    )
    next_start_offset = first_start_offset + first_days  # the day right after `first` ends

    second = create_reservation(
        db_session, item_id=item.id, renter_id=renter2.id, data=_dates(next_start_offset, 2)
    )

    assert second.status == "requested"
    assert first.id != second.id
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.reservations'`.

- [ ] **Step 3: Create `app/services/reservations.py`**

```python
"""Business logic for Reservations: request creation with double-booking
prevention (Task 3), approve/reject/cancel (Task 4), and listing (Task 5).
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.models.item import Item
from app.models.reservation import BLOCKING_STATUSES, Reservation
from app.schemas.reservation import CreateReservationRequest


def create_reservation(
    db: Session, item_id: uuid.UUID, renter_id: uuid.UUID, data: CreateReservationRequest
) -> Reservation:
    """Request a reservation for an item.

    Runs, in order: date validation, item lookup (with a row lock held
    for the rest of this function — see below), the "can't rent your
    own item" check, the exact-duplicate check, the overlap check, then
    the insert. The Item row lock (SELECT ... FOR UPDATE) is acquired
    at lookup time and held until this transaction commits or rolls
    back, so no concurrent call for the same item can pass its own
    lookup until this one is done — that's what actually prevents the
    race, not the overlap SELECT by itself. The no_double_booking
    EXCLUDE constraint added by this feature's migration is the second,
    database-level layer: if this application-level check ever has a
    bug, Postgres itself rejects the INSERT (caught below).

    Args:
        db: Database session.
        item_id: The item being requested.
        renter_id: The authenticated caller's id — always the renter,
            never taken from the request body.
        data: Validated start_date/end_date.

    Returns:
        The newly created Reservation, status "requested".

    Raises:
        AppError: 422 VALIDATION_ERROR if start_date is in the past or
            end_date < start_date. 404 NOT_FOUND if the item doesn't
            exist or is inactive. 422 CANNOT_RENT_OWN_ITEM if the caller
            owns the item. 409 DUPLICATE_RESERVATION if an identical
            request (same renter+item+dates) is already "requested".
            409 DATES_UNAVAILABLE if the dates overlap an existing
            active reservation, caught either by the application check
            or the database's EXCLUDE constraint.
    """
    if data.start_date < date.today():
        raise AppError(422, "VALIDATION_ERROR", "start_date must be today or in the future")
    if data.end_date < data.start_date:
        raise AppError(422, "VALIDATION_ERROR", "end_date must be on or after start_date")

    item = db.scalar(
        select(Item)
        .where(Item.id == item_id, Item.is_active == True)  # noqa: E712
        .with_for_update()
    )
    if item is None:
        raise AppError(404, "NOT_FOUND", "Item not found")

    if item.owner_id == renter_id:
        raise AppError(422, "CANNOT_RENT_OWN_ITEM", "You cannot rent your own item")

    duplicate = db.scalar(
        select(Reservation.id).where(
            Reservation.item_id == item_id,
            Reservation.renter_id == renter_id,
            Reservation.start_date == data.start_date,
            Reservation.end_date == data.end_date,
            Reservation.status == "requested",
        )
    )
    if duplicate is not None:
        raise AppError(
            409, "DUPLICATE_RESERVATION", "An identical reservation request already exists"
        )

    overlap = db.scalar(
        select(Reservation.id).where(
            Reservation.item_id == item_id,
            Reservation.status.in_(BLOCKING_STATUSES),
            Reservation.start_date <= data.end_date,
            Reservation.end_date >= data.start_date,
        )
    )
    if overlap is not None:
        raise AppError(409, "DATES_UNAVAILABLE", "The requested dates are not available")

    days = (data.end_date - data.start_date).days + 1
    reservation = Reservation(
        item_id=item_id,
        renter_id=renter_id,
        start_date=data.start_date,
        end_date=data.end_date,
        status="requested",
        deposit_amount=item.price_per_day * days,
    )
    db.add(reservation)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "DATES_UNAVAILABLE", "The requested dates are not available")
    db.refresh(reservation)
    return reservation
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/services/reservations.py tests/services/test_reservations.py
git commit -m "feat(api): add create_reservation with two-layer double-booking prevention"
```

---

### Task 4: `approve_reservation`, `reject_reservation`, `cancel_reservation`

**Files:**
- Modify: `apps/api/app/services/reservations.py` (append)
- Modify: `apps/api/tests/services/test_reservations.py` (append)

**Interfaces:**
- Consumes: `app.models.reservation.Reservation`, `app.models.reservation.Transaction`, `app.exceptions.AppError`, Task 3's `create_reservation` (tests build state by calling it, not by poking the DB directly).
- Produces: `approve_reservation(db, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation`, `reject_reservation(db, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation`, `cancel_reservation(db, reservation_id: uuid.UUID, renter_id: uuid.UUID) -> Reservation` (all raise `AppError`) — used by Task 6's router and Task 5's tests.

- [ ] **Step 1: Append the failing tests to `tests/services/test_reservations.py`**

```python
def test_approve_reservation_happy_path_creates_hold_transaction(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: approving moves status to approved and inserts a hold
    transaction for the full deposit amount.
    """
    from app.services.reservations import approve_reservation, create_reservation

    owner = make_user(email="approve-owner1@example.com")
    renter = make_user(email="approve-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    approved = approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert approved.status == "approved"
    assert approved.deposit_status == "held"


def test_approve_reservation_requires_ownership(db_session: Session, make_user, make_item) -> None:
    """Failure path: a non-owner can't approve, 403 FORBIDDEN."""
    from app.services.reservations import approve_reservation, create_reservation

    owner = make_user(email="approve-owner2@example.com")
    renter = make_user(email="approve-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(10, 2)
    )

    with pytest.raises(AppError) as exc_info:
        approve_reservation(db_session, reservation_id=reservation.id, owner_id=renter.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_approve_reservation_requires_requested_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: approving an already-approved reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import approve_reservation, create_reservation

    owner = make_user(email="approve-owner3@example.com")
    renter = make_user(email="approve-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(15, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_approve_reservation_raises_not_found(db_session: Session, make_user) -> None:
    """Failure path: a random reservation id is 404 NOT_FOUND."""
    from app.services.reservations import approve_reservation

    owner = make_user(email="approve-owner4@example.com")

    with pytest.raises(AppError) as exc_info:
        approve_reservation(db_session, reservation_id=uuid.uuid4(), owner_id=owner.id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_reject_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: rejecting moves status to rejected, no transaction created."""
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="reject-owner1@example.com")
    renter = make_user(email="reject-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(20, 2)
    )

    rejected = reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert rejected.status == "rejected"
    assert rejected.deposit_status == "none"


def test_reject_reservation_requires_ownership(db_session: Session, make_user, make_item) -> None:
    """Failure path: a non-owner can't reject, 403 FORBIDDEN."""
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="reject-owner2@example.com")
    renter = make_user(email="reject-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(25, 2)
    )

    with pytest.raises(AppError) as exc_info:
        reject_reservation(db_session, reservation_id=reservation.id, owner_id=renter.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_reject_reservation_requires_requested_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: rejecting an already-rejected reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="reject-owner3@example.com")
    renter = make_user(email="reject-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(30, 2)
    )
    reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_cancel_reservation_happy_path_from_requested_no_release(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: cancelling a merely-requested reservation creates no
    transaction — nothing was ever held.
    """
    from app.services.reservations import cancel_reservation, create_reservation

    owner = make_user(email="cancel-owner1@example.com")
    renter = make_user(email="cancel-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(35, 2)
    )

    cancelled = cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    assert cancelled.status == "cancelled"
    assert cancelled.deposit_status == "none"


def test_cancel_reservation_happy_path_from_approved_creates_release(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: cancelling an approved reservation releases the held
    deposit.
    """
    from app.services.reservations import (
        approve_reservation,
        cancel_reservation,
        create_reservation,
    )

    owner = make_user(email="cancel-owner2@example.com")
    renter = make_user(email="cancel-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(40, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    cancelled = cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    assert cancelled.status == "cancelled"
    assert cancelled.deposit_status == "released"


def test_cancel_reservation_requires_renter(db_session: Session, make_user, make_item) -> None:
    """Failure path: the item owner can't cancel on the renter's behalf,
    403 FORBIDDEN.
    """
    from app.services.reservations import cancel_reservation, create_reservation

    owner = make_user(email="cancel-owner3@example.com")
    renter = make_user(email="cancel-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(45, 2)
    )

    with pytest.raises(AppError) as exc_info:
        cancel_reservation(db_session, reservation_id=reservation.id, renter_id=owner.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_cancel_reservation_requires_requested_or_approved_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: cancelling an already-cancelled reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import cancel_reservation, create_reservation

    owner = make_user(email="cancel-owner4@example.com")
    renter = make_user(email="cancel-renter4@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(50, 2)
    )
    cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    with pytest.raises(AppError) as exc_info:
        cancel_reservation(db_session, reservation_id=reservation.id, renter_id=renter.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: FAIL — `ImportError: cannot import name 'approve_reservation' from 'app.services.reservations'` (Task 3's 9 tests still pass).

- [ ] **Step 3: Append the transition functions to `app/services/reservations.py`**

Find:

```python
from sqlalchemy.orm import Session
```

Replace with:

```python
from sqlalchemy.orm import Session, joinedload
```

And add `Transaction` to the existing `from app.models.reservation import ...` line, so it reads:

```python
from app.models.reservation import BLOCKING_STATUSES, Reservation, Transaction
```

Append this to the end of the file:

```python
def _get_reservation_or_404(db: Session, reservation_id: uuid.UUID) -> Reservation:
    """Look up a reservation by id, with its item and renter pre-loaded.

    Args:
        db: Database session.
        reservation_id: The reservation's id.

    Returns:
        The matching Reservation.

    Raises:
        AppError: 404 NOT_FOUND if no reservation exists with that id.
    """
    reservation = db.scalar(
        select(Reservation)
        .options(joinedload(Reservation.item), joinedload(Reservation.renter))
        .where(Reservation.id == reservation_id)
    )
    if reservation is None:
        raise AppError(404, "NOT_FOUND", "Reservation not found")
    return reservation


def approve_reservation(db: Session, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation:
    """Owner approves a requested reservation.

    Args:
        db: Database session.
        reservation_id: The reservation to approve.
        owner_id: The authenticated caller's id — must be the item's owner.

    Returns:
        The approved Reservation, with a "hold" Transaction inserted.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't the item's owner. 409
            INVALID_TRANSITION if the reservation isn't "requested".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")
    if reservation.status != "requested":
        raise AppError(409, "INVALID_TRANSITION", "Only a requested reservation can be approved")

    reservation.status = "approved"
    db.add(
        Transaction(reservation_id=reservation.id, type="hold", amount=reservation.deposit_amount)
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def reject_reservation(db: Session, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation:
    """Owner rejects a requested reservation. No transaction is created —
    nothing was ever held.

    Args:
        db: Database session.
        reservation_id: The reservation to reject.
        owner_id: The authenticated caller's id — must be the item's owner.

    Returns:
        The rejected Reservation.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't the item's owner. 409
            INVALID_TRANSITION if the reservation isn't "requested".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")
    if reservation.status != "requested":
        raise AppError(409, "INVALID_TRANSITION", "Only a requested reservation can be rejected")

    reservation.status = "rejected"
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(db: Session, reservation_id: uuid.UUID, renter_id: uuid.UUID) -> Reservation:
    """Renter cancels their own reservation. If it had already been
    approved (meaning a "hold" transaction exists), a "release" is
    inserted to return the deposit.

    Args:
        db: Database session.
        reservation_id: The reservation to cancel.
        renter_id: The authenticated caller's id — must be the
            reservation's renter.

    Returns:
        The cancelled Reservation.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't its renter. 409
            INVALID_TRANSITION if it's not "requested" or "approved".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.renter_id != renter_id:
        raise AppError(403, "FORBIDDEN", "You are not the renter for this reservation")
    if reservation.status not in ("requested", "approved"):
        raise AppError(
            409, "INVALID_TRANSITION", "Only a requested or approved reservation can be cancelled"
        )

    had_hold = reservation.status == "approved"
    reservation.status = "cancelled"
    if had_hold:
        db.add(
            Transaction(
                reservation_id=reservation.id, type="release", amount=reservation.deposit_amount
            )
        )
    db.commit()
    db.refresh(reservation)
    return reservation
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: `20 passed` (9 from Task 3 + 11 new).

- [ ] **Step 5: Commit**

```bash
git add app/services/reservations.py tests/services/test_reservations.py
git commit -m "feat(api): add approve_reservation, reject_reservation, cancel_reservation"
```

---

### Task 5: `list_my_reservations`, `list_my_requests`

**Files:**
- Modify: `apps/api/app/services/reservations.py` (append)
- Modify: `apps/api/tests/conftest.py` (add `make_reservation` fixture)
- Modify: `apps/api/tests/services/test_reservations.py` (append)

**Interfaces:**
- Consumes: `app.models.reservation.Reservation`, `app.models.item.Item`.
- Produces: `list_my_reservations(db, renter_id, status=None, page=1, limit=20) -> tuple[list[Reservation], int]`, `list_my_requests(db, owner_id, status=None, page=1, limit=20) -> tuple[list[Reservation], int]` — used by Task 6's router. `make_reservation` fixture (`make_reservation(item_id, renter_id, start_date=..., end_date=..., status=..., deposit_amount=...) -> Reservation`, persists directly, bypassing service validation) — used by this task's own tests, for constructing reservations in statuses unreachable via Week 2's endpoints alone (e.g. filtering by an arbitrary status).

- [ ] **Step 1: Add the `make_reservation` fixture to `tests/conftest.py`**

Add this import to the top of `apps/api/tests/conftest.py` (alongside the existing ones):

```python
from datetime import date

from app.models.reservation import Reservation
```

Then append this fixture to the end of the file:

```python
@pytest.fixture()
def make_reservation(db_session: Session):
    """Factory fixture: persists a Reservation directly, bypassing the
    service layer's validations (dates, ownership, double-booking).
    Only for constructing fixtures in states unreachable through Week
    2's endpoints alone (e.g. arbitrary status values for testing list
    filters) — prefer calling create_reservation/approve_reservation/
    reject_reservation/cancel_reservation directly when testing a real
    transition.

    Returns:
        A callable ``make_reservation(item_id, renter_id, start_date=...,
        end_date=..., status=..., deposit_amount=...) -> Reservation``
        that inserts and returns a fully persisted Reservation. Callers
        creating multiple reservations for the SAME item must pass
        distinct, non-overlapping dates (or a status outside
        BLOCKING_STATUSES) to avoid the no_double_booking constraint.
    """

    def _make_reservation(
        item_id,
        renter_id,
        start_date: date = date(2027, 1, 1),
        end_date: date = date(2027, 1, 3),
        status: str = "requested",
        deposit_amount: int = 15000,
    ) -> Reservation:
        reservation = Reservation(
            item_id=item_id,
            renter_id=renter_id,
            start_date=start_date,
            end_date=end_date,
            status=status,
            deposit_amount=deposit_amount,
        )
        db_session.add(reservation)
        db_session.commit()
        db_session.refresh(reservation)
        return reservation

    return _make_reservation
```

- [ ] **Step 2: Write the failing tests**

Append these tests to the end of `apps/api/tests/services/test_reservations.py`:

```python
def test_list_my_reservations_returns_only_callers_own(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: renter A's list doesn't include renter B's reservations."""
    from app.services.reservations import list_my_reservations

    owner = make_user(email="list-owner1@example.com")
    renter_a = make_user(email="list-renter1a@example.com")
    renter_b = make_user(email="list-renter1b@example.com")
    item = make_item(owner_id=owner.id)
    make_reservation(item.id, renter_a.id, start_date=date(2027, 2, 1), end_date=date(2027, 2, 3))
    make_reservation(item.id, renter_b.id, start_date=date(2027, 3, 1), end_date=date(2027, 3, 3))

    reservations, total = list_my_reservations(db_session, renter_id=renter_a.id)

    assert total == 1
    assert reservations[0].renter_id == renter_a.id


def test_list_my_reservations_filters_by_status(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: status filter narrows the results."""
    from app.services.reservations import list_my_reservations

    owner = make_user(email="list-owner2@example.com")
    renter = make_user(email="list-renter2@example.com")
    item = make_item(owner_id=owner.id)
    make_reservation(
        item.id, renter.id, start_date=date(2027, 4, 1), end_date=date(2027, 4, 3),
        status="requested",
    )
    make_reservation(
        item.id, renter.id, start_date=date(2027, 5, 1), end_date=date(2027, 5, 3),
        status="cancelled",
    )

    reservations, total = list_my_reservations(db_session, renter_id=renter.id, status="cancelled")

    assert total == 1
    assert reservations[0].status == "cancelled"


def test_list_my_reservations_paginates(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: limit caps the page size, total reflects all matches."""
    from app.services.reservations import list_my_reservations

    owner = make_user(email="list-owner3@example.com")
    renter = make_user(email="list-renter3@example.com")
    item = make_item(owner_id=owner.id)
    for i in range(3):
        make_reservation(
            item.id, renter.id,
            start_date=date(2027, 6, 1 + i * 10), end_date=date(2027, 6, 2 + i * 10),
        )

    page_1, total = list_my_reservations(db_session, renter_id=renter.id, page=1, limit=2)
    page_2, _ = list_my_reservations(db_session, renter_id=renter.id, page=2, limit=2)

    assert total == 3
    assert len(page_1) == 2
    assert len(page_2) == 1


def test_list_my_requests_returns_requests_on_owned_items_only(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: owner A's requests don't include reservations on
    owner B's items.
    """
    from app.services.reservations import list_my_requests

    owner_a = make_user(email="list-owner4a@example.com")
    owner_b = make_user(email="list-owner4b@example.com")
    renter = make_user(email="list-renter4@example.com")
    item_a = make_item(owner_id=owner_a.id, name="Item A")
    item_b = make_item(owner_id=owner_b.id, name="Item B")
    make_reservation(item_a.id, renter.id, start_date=date(2027, 7, 1), end_date=date(2027, 7, 3))
    make_reservation(item_b.id, renter.id, start_date=date(2027, 8, 1), end_date=date(2027, 8, 3))

    reservations, total = list_my_requests(db_session, owner_id=owner_a.id)

    assert total == 1
    assert reservations[0].item_id == item_a.id


def test_list_my_requests_filters_by_status(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: status filter narrows the owner's incoming requests."""
    from app.services.reservations import list_my_requests

    owner = make_user(email="list-owner5@example.com")
    renter = make_user(email="list-renter5@example.com")
    item = make_item(owner_id=owner.id)
    make_reservation(
        item.id, renter.id, start_date=date(2027, 9, 1), end_date=date(2027, 9, 3),
        status="requested",
    )
    make_reservation(
        item.id, renter.id, start_date=date(2027, 10, 1), end_date=date(2027, 10, 3),
        status="rejected",
    )

    reservations, total = list_my_requests(db_session, owner_id=owner.id, status="rejected")

    assert total == 1
    assert reservations[0].status == "rejected"
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: FAIL — `ImportError: cannot import name 'list_my_reservations' from 'app.services.reservations'` (Tasks 3-4's 20 tests still pass).

- [ ] **Step 4: Append the listing functions to `app/services/reservations.py`**

Find:

```python
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
```

Replace with:

```python
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload
```

Append this to the end of the file:

```python
def list_my_reservations(
    db: Session, renter_id: uuid.UUID, status: str | None = None, page: int = 1, limit: int = 20
) -> tuple[list[Reservation], int]:
    """List the authenticated user's reservations as a renter.

    Args:
        db: Database session.
        renter_id: The authenticated caller's id.
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page.

    Returns:
        A tuple of (reservations for the requested page, total matching
        count across all pages).
    """
    query = (
        select(Reservation)
        .options(
            joinedload(Reservation.item),
            joinedload(Reservation.renter),
            selectinload(Reservation.transactions),
        )
        .where(Reservation.renter_id == renter_id)
    )
    if status is not None:
        query = query.where(Reservation.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.order_by(Reservation.created_at.desc()).offset((page - 1) * limit).limit(limit)
    reservations = list(db.scalars(query).unique())
    return reservations, total


def list_my_requests(
    db: Session, owner_id: uuid.UUID, status: str | None = None, page: int = 1, limit: int = 20
) -> tuple[list[Reservation], int]:
    """List reservation requests received on items the authenticated
    user owns.

    Args:
        db: Database session.
        owner_id: The authenticated caller's id.
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page.

    Returns:
        A tuple of (reservations for the requested page, total matching
        count across all pages).
    """
    query = (
        select(Reservation)
        .options(
            joinedload(Reservation.item),
            joinedload(Reservation.renter),
            selectinload(Reservation.transactions),
        )
        .where(Reservation.item_id.in_(select(Item.id).where(Item.owner_id == owner_id)))
    )
    if status is not None:
        query = query.where(Reservation.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    query = query.order_by(Reservation.created_at.desc()).offset((page - 1) * limit).limit(limit)
    reservations = list(db.scalars(query).unique())
    return reservations, total
```

- [ ] **Step 5: Run the tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: `25 passed` (20 from Tasks 3-4 + 5 new).

- [ ] **Step 6: Commit**

```bash
git add app/services/reservations.py tests/conftest.py tests/services/test_reservations.py
git commit -m "feat(api): add list_my_reservations and list_my_requests"
```

---

### Task 6: Reservations router — wire it all together

**Files:**
- Create: `apps/api/app/routers/reservations.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/routers/test_reservations.py`

**Interfaces:**
- Consumes: everything from Tasks 1-5, plus `app.dependencies.auth.get_current_user`.
- Produces: the 6 live HTTP endpoints (`POST /items/{item_id}/reservations`, `GET /users/me/reservations`, `GET /users/me/requests`, `PATCH /reservations/{id}/approve`, `PATCH /reservations/{id}/reject`, `PATCH /reservations/{id}/cancel`).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/routers/test_reservations.py`:

```python
"""Integration tests for the Reservations endpoints."""

from datetime import date, timedelta

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Test User", "email": email, "password": "securepass123"},
    )
    login = client.post("/auth/login", json={"email": email, "password": "securepass123"})
    return login.json()["access_token"]


def _create_item(client: TestClient, token: str, price_per_day: int = 5000) -> str:
    response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Taladro Bosch",
            "description": "Percutor profesional",
            "category": "tools",
            "price_per_day": price_per_day,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    return response.json()["id"]


def test_create_reservation_endpoint_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    owner_token = _register_and_login(client, "resrouter-owner1@example.com")
    item_id = _create_item(client, owner_token)

    response = client.post(
        f"/items/{item_id}/reservations",
        json={
            "start_date": str(date.today() + timedelta(days=5)),
            "end_date": str(date.today() + timedelta(days=7)),
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_create_reservation_endpoint_happy_path_renter_id_from_token(client: TestClient) -> None:
    """Happy path + security check: renter_id in the response is the
    authenticated user's id, and deposit_amount is computed server-side.
    """
    owner_token = _register_and_login(client, "resrouter-owner2@example.com")
    item_id = _create_item(client, owner_token, price_per_day=5000)
    renter_token = _register_and_login(client, "resrouter-renter2@example.com")

    response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=5)),
            "end_date": str(date.today() + timedelta(days=7)),
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "requested"
    assert body["deposit_amount"] == 15000
    assert body["item_name"] == "Taladro Bosch"


def test_create_reservation_endpoint_rejects_own_item(client: TestClient) -> None:
    """Failure path: an owner can't rent their own item, 422 CANNOT_RENT_OWN_ITEM."""
    owner_token = _register_and_login(client, "resrouter-owner3@example.com")
    item_id = _create_item(client, owner_token)

    response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=5)),
            "end_date": str(date.today() + timedelta(days=7)),
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CANNOT_RENT_OWN_ITEM"


def test_list_my_reservations_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: a reservation I made as a renter shows up in my list."""
    owner_token = _register_and_login(client, "resrouter-owner4@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter4@example.com")
    client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=10)),
            "end_date": str(date.today() + timedelta(days=12)),
        },
    )

    response = client.get(
        "/users/me/reservations", headers={"Authorization": f"Bearer {renter_token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["reservations"][0]["item_name"] == "Taladro Bosch"


def test_list_my_requests_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: a reservation on my item shows up in my requests,
    with the renter's name included.
    """
    owner_token = _register_and_login(client, "resrouter-owner5@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter5@example.com")
    client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=15)),
            "end_date": str(date.today() + timedelta(days=16)),
        },
    )

    response = client.get("/users/me/requests", headers={"Authorization": f"Bearer {owner_token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["reservations"][0]["renter_name"] == "Test User"


def test_approve_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the owner approves a requested reservation,
    deposit_status becomes held.
    """
    owner_token = _register_and_login(client, "resrouter-owner6@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter6@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=20)),
            "end_date": str(date.today() + timedelta(days=21)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["deposit_status"] == "held"


def test_approve_endpoint_forbidden_for_non_owner(client: TestClient) -> None:
    """Failure path: someone who isn't the item's owner gets 403 FORBIDDEN."""
    owner_token = _register_and_login(client, "resrouter-owner7@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter7@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=25)),
            "end_date": str(date.today() + timedelta(days=26)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {renter_token}"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_approve_endpoint_returns_404_for_missing_reservation(client: TestClient) -> None:
    """Failure path: a well-formed but nonexistent id returns 404 NOT_FOUND."""
    owner_token = _register_and_login(client, "resrouter-owner8@example.com")

    response = client.patch(
        "/reservations/00000000-0000-0000-0000-000000000000/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_reject_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the owner rejects a requested reservation, no deposit
    ever held.
    """
    owner_token = _register_and_login(client, "resrouter-owner9@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter9@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=30)),
            "end_date": str(date.today() + timedelta(days=31)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.patch(
        f"/reservations/{reservation_id}/reject",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected"
    assert body["deposit_status"] == "none"


def test_cancel_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the renter cancels an approved reservation,
    deposit_status becomes released.
    """
    owner_token = _register_and_login(client, "resrouter-owner10@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter10@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=35)),
            "end_date": str(date.today() + timedelta(days=36)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    response = client.patch(
        f"/reservations/{reservation_id}/cancel",
        headers={"Authorization": f"Bearer {renter_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cancelled"
    assert body["deposit_status"] == "released"


def test_cancel_endpoint_forbidden_for_non_renter(client: TestClient) -> None:
    """Failure path: the item owner can't cancel on the renter's behalf,
    403 FORBIDDEN.
    """
    owner_token = _register_and_login(client, "resrouter-owner11@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter11@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=40)),
            "end_date": str(date.today() + timedelta(days=41)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.patch(
        f"/reservations/{reservation_id}/cancel",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/routers/test_reservations.py -v`
Expected: FAIL — `404 Not Found` for all requests (no reservations routes registered yet).

- [ ] **Step 3: Create `app/routers/reservations.py`**

```python
"""Reservations endpoints: request, list mine/requests, approve, reject, cancel."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.reservation import (
    CreateReservationRequest,
    ReservationListResponse,
    ReservationResponse,
    ReservationStatusEnum,
)
from app.services.reservations import (
    approve_reservation,
    cancel_reservation,
    create_reservation,
    list_my_requests,
    list_my_reservations,
    reject_reservation,
)

router = APIRouter()


@router.post("/items/{item_id}/reservations", status_code=201)
def create_reservation_endpoint(
    item_id: UUID,
    data: CreateReservationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Request a reservation. renter_id is always the authenticated user.

    Args:
        item_id: The item to reserve.
        data: The requested start_date/end_date.
        current_user: Resolved by get_current_user — the reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The newly created reservation's public representation.
    """
    reservation = create_reservation(db, item_id=item_id, renter_id=current_user.id, data=data)
    return ReservationResponse.model_validate(reservation)


@router.get("/users/me/reservations")
def list_my_reservations_endpoint(
    status: ReservationStatusEnum | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationListResponse:
    """List my reservations as a renter.

    Args:
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page, max 50.
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        The matching page of my reservations, plus pagination metadata.
    """
    reservations, total = list_my_reservations(
        db,
        renter_id=current_user.id,
        status=status.value if status else None,
        page=page,
        limit=limit,
    )
    return ReservationListResponse(
        reservations=[ReservationResponse.model_validate(r) for r in reservations],
        page=page,
        limit=limit,
        total=total,
    )


@router.get("/users/me/requests")
def list_my_requests_endpoint(
    status: ReservationStatusEnum | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationListResponse:
    """List reservation requests received on items I own.

    Args:
        status: Optional exact status filter.
        page: 1-indexed page number.
        limit: Reservations per page, max 50.
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        The matching page of requests on my items, plus pagination metadata.
    """
    reservations, total = list_my_requests(
        db,
        owner_id=current_user.id,
        status=status.value if status else None,
        page=page,
        limit=limit,
    )
    return ReservationListResponse(
        reservations=[ReservationResponse.model_validate(r) for r in reservations],
        page=page,
        limit=limit,
        total=total,
    )


@router.patch("/reservations/{reservation_id}/approve")
def approve_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Owner approves a requested reservation.

    Args:
        reservation_id: The reservation to approve.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The approved reservation's public representation.
    """
    reservation = approve_reservation(db, reservation_id=reservation_id, owner_id=current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.patch("/reservations/{reservation_id}/reject")
def reject_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Owner rejects a requested reservation.

    Args:
        reservation_id: The reservation to reject.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The rejected reservation's public representation.
    """
    reservation = reject_reservation(db, reservation_id=reservation_id, owner_id=current_user.id)
    return ReservationResponse.model_validate(reservation)


@router.patch("/reservations/{reservation_id}/cancel")
def cancel_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Renter cancels their reservation.

    Args:
        reservation_id: The reservation to cancel.
        current_user: Resolved by get_current_user — must be the reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The cancelled reservation's public representation.
    """
    reservation = cancel_reservation(db, reservation_id=reservation_id, renter_id=current_user.id)
    return ReservationResponse.model_validate(reservation)
```

- [ ] **Step 4: Register the router in `app/main.py`**

Find:
```python
from app.routers import auth, health, items
```
Replace with:
```python
from app.routers import auth, health, items, reservations
```

Find:
```python
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(items.router)
```
Replace with:
```python
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(items.router)
app.include_router(reservations.router)
```

- [ ] **Step 5: Run the tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/routers/test_reservations.py -v`
Expected: `11 passed`.

- [ ] **Step 6: Run the entire test suite as a regression check**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/ -v`
Expected: all tests pass (65 baseline + 7 model + 3 schema + 20 service(create+transitions) + 5 service(list) + 11 router = 111 passed).

- [ ] **Step 7: Commit**

```bash
git add app/routers/reservations.py app/main.py tests/routers/test_reservations.py
git commit -m "feat(api): add request, list, approve, reject, cancel endpoints for reservations"
```

---

### Task 7: Wire `GET /items` availability filters and `GET /items/{item_id}` unavailable_dates

**Files:**
- Modify: `apps/api/app/services/items.py`
- Modify: `apps/api/app/routers/items.py`
- Modify: `apps/api/tests/services/test_items.py` (append)
- Modify: `apps/api/tests/routers/test_items.py` (append)

**Interfaces:**
- Consumes: `app.models.reservation.Reservation`, `app.models.reservation.BLOCKING_STATUSES` (from Task 1).
- Produces: `get_unavailable_dates(db, item_id: uuid.UUID) -> list[dict[str, str]]` — used by the `GET /items/{item_id}` router endpoint. `list_items` now actually filters on `available_from`/`available_to` instead of accepting-and-ignoring them.

- [ ] **Step 1: Write the failing service tests**

Append these tests to the end of `apps/api/tests/services/test_items.py` (the file already imports `date`, `timedelta`, `Session`, `make_user`, `make_item` — no new imports needed at the top):

```python
def test_get_unavailable_dates_returns_blocking_reservation_ranges(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: a requested reservation shows up as an unavailable range."""
    from app.schemas.reservation import CreateReservationRequest
    from app.services.items import get_unavailable_dates
    from app.services.reservations import create_reservation

    owner = make_user(email="avail-owner1@example.com")
    renter = make_user(email="avail-renter1@example.com")
    item = make_item(owner_id=owner.id)
    start = date.today() + timedelta(days=5)
    end = date.today() + timedelta(days=7)
    create_reservation(
        db_session,
        item_id=item.id,
        renter_id=renter.id,
        data=CreateReservationRequest(start_date=start, end_date=end),
    )

    ranges = get_unavailable_dates(db_session, item.id)

    assert ranges == [{"start_date": start.isoformat(), "end_date": end.isoformat()}]


def test_get_unavailable_dates_excludes_rejected_reservations(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: a rejected reservation frees its dates."""
    from app.schemas.reservation import CreateReservationRequest
    from app.services.items import get_unavailable_dates
    from app.services.reservations import create_reservation, reject_reservation

    owner = make_user(email="avail-owner2@example.com")
    renter = make_user(email="avail-renter2@example.com")
    item = make_item(owner_id=owner.id)
    start = date.today() + timedelta(days=10)
    end = date.today() + timedelta(days=12)
    reservation = create_reservation(
        db_session,
        item_id=item.id,
        renter_id=renter.id,
        data=CreateReservationRequest(start_date=start, end_date=end),
    )
    reject_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    ranges = get_unavailable_dates(db_session, item.id)

    assert ranges == []


def test_list_items_excludes_item_with_overlapping_reservation_in_available_range(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: an item with a blocking reservation overlapping the
    requested available_from/available_to window is excluded.
    """
    from app.schemas.reservation import CreateReservationRequest
    from app.services.items import list_items
    from app.services.reservations import create_reservation

    owner = make_user(email="avail-owner3@example.com")
    renter = make_user(email="avail-renter3@example.com")
    booked = make_item(owner_id=owner.id, name="Reservado")
    free = make_item(owner_id=owner.id, name="Libre")
    start = date.today() + timedelta(days=20)
    end = date.today() + timedelta(days=22)
    create_reservation(
        db_session,
        item_id=booked.id,
        renter_id=renter.id,
        data=CreateReservationRequest(start_date=start, end_date=end),
    )

    items, total = list_items(db_session, available_from=start, available_to=end)

    assert total == 1
    assert items[0].name == "Libre"


def test_list_items_available_filter_open_ended_on_one_side_still_excludes_overlap(
    db_session: Session, make_user, make_item
) -> None:
    """Edge case: passing only available_from still excludes an item
    whose blocking reservation starts after that date.
    """
    from app.schemas.reservation import CreateReservationRequest
    from app.services.items import list_items
    from app.services.reservations import create_reservation

    owner = make_user(email="avail-owner4@example.com")
    renter = make_user(email="avail-renter4@example.com")
    booked = make_item(owner_id=owner.id, name="Reservado2")
    start = date.today() + timedelta(days=30)
    end = date.today() + timedelta(days=32)
    create_reservation(
        db_session,
        item_id=booked.id,
        renter_id=renter.id,
        data=CreateReservationRequest(start_date=start, end_date=end),
    )

    items, total = list_items(db_session, available_from=start)

    assert total == 0
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_items.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_unavailable_dates' from 'app.services.items'` (all pre-existing `test_items.py` tests still pass).

- [ ] **Step 3: Update `app/services/items.py`**

Add this import to the top of the file (alongside the existing ones):

```python
from app.models.reservation import BLOCKING_STATUSES, Reservation
```

In the `list_items` docstring, find:

```python
        available_from: Accepted and validated, but doesn't exclude
            anything yet — no Reservation table exists to check against.
        available_to: Same as available_from.
```

Replace with:

```python
        available_from: Inclusive lower bound. If given (with or
            without available_to), excludes any item with a blocking
            reservation overlapping [available_from, available_to].
        available_to: Inclusive upper bound. Same exclusion as
            available_from — either can be sent alone as an open-ended
            bound on the other side.
```

Replace the body of `list_items` — find:

```python
    if max_price is not None:
        query = query.where(Item.price_per_day <= max_price)

    total = db.scalar(select(func.count()).select_from(query.subquery()))
```

Replace with:

```python
    if max_price is not None:
        query = query.where(Item.price_per_day <= max_price)
    if available_from is not None or available_to is not None:
        range_start = available_from or date.min
        range_end = available_to or date.max
        query = query.where(
            ~Item.id.in_(
                select(Reservation.item_id).where(
                    Reservation.status.in_(BLOCKING_STATUSES),
                    Reservation.start_date <= range_end,
                    Reservation.end_date >= range_start,
                )
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery()))
```

Append this function to the end of the file:

```python
def get_unavailable_dates(db: Session, item_id: uuid.UUID) -> list[dict[str, str]]:
    """List every date range this item is unavailable for, derived from
    its active (blocking) reservations.

    Args:
        db: Database session.
        item_id: The item's id.

    Returns:
        A list of {"start_date": "...", "end_date": "..."} dicts
        (ISO 8601), ordered by start_date. Empty if the item has no
        blocking reservations.
    """
    rows = db.execute(
        select(Reservation.start_date, Reservation.end_date)
        .where(Reservation.item_id == item_id, Reservation.status.in_(BLOCKING_STATUSES))
        .order_by(Reservation.start_date)
    ).all()
    return [
        {"start_date": row.start_date.isoformat(), "end_date": row.end_date.isoformat()}
        for row in rows
    ]
```

- [ ] **Step 4: Run the service tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_items.py -v`
Expected: all pass (pre-existing count + 4 new).

- [ ] **Step 5: Write the failing router test**

Add this import to the top of `apps/api/tests/routers/test_items.py`:

```python
from datetime import date, timedelta
```

Append this test to the end of the file:

```python
def test_get_item_endpoint_returns_populated_unavailable_dates(client: TestClient) -> None:
    """Happy path: once a reservation exists, unavailable_dates reflects it."""
    owner_token = _register_and_login(client, "owner-avail@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Carpa Disponible",
            "description": "4 personas",
            "category": "camping",
            "price_per_day": 3000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]
    renter_token = _register_and_login(client, "renter-avail@example.com")
    start = date.today() + timedelta(days=5)
    end = date.today() + timedelta(days=7)
    client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"start_date": str(start), "end_date": str(end)},
    )

    response = client.get(f"/items/{item_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["unavailable_dates"] == [
        {"start_date": start.isoformat(), "end_date": end.isoformat()}
    ]
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/routers/test_items.py -v`
Expected: FAIL — `assert [] == [{'start_date': ..., 'end_date': ...}]` (the router still hardcodes the stub).

- [ ] **Step 7: Update `app/routers/items.py`**

Find:

```python
from app.services.items import create_item, get_item, list_items
```

Replace with:

```python
from app.services.items import create_item, get_item, get_unavailable_dates, list_items
```

Find the whole `get_item_endpoint` function:

```python
@router.get("/items/{item_id}")
def get_item_endpoint(item_id: UUID, db: Session = Depends(get_db)) -> ItemDetailResponse:
    """Get an item's detail, including its (currently always empty)
    unavailable date ranges.

    Args:
        item_id: The item's id.
        db: Database session injected by FastAPI.

    Returns:
        The item's detail representation.
    """
    item = get_item(db, item_id)
    return ItemDetailResponse.model_validate(item)
```

Replace with:

```python
@router.get("/items/{item_id}")
def get_item_endpoint(item_id: UUID, db: Session = Depends(get_db)) -> ItemDetailResponse:
    """Get an item's detail, including its unavailable date ranges.

    Args:
        item_id: The item's id.
        db: Database session injected by FastAPI.

    Returns:
        The item's detail representation.
    """
    item = get_item(db, item_id)
    response = ItemDetailResponse.model_validate(item)
    response.unavailable_dates = get_unavailable_dates(db, item_id)
    return response
```

- [ ] **Step 8: Run the router tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/routers/test_items.py -v`
Expected: all pass (pre-existing count + 1 new).

- [ ] **Step 9: Run the entire test suite as a final regression check**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/ -v`
Expected: all tests pass (111 from Task 6 + 5 new = **116 passed**).

- [ ] **Step 10: Commit**

```bash
git add app/services/items.py app/routers/items.py tests/services/test_items.py tests/routers/test_items.py
git commit -m "feat(api): wire GET /items availability filters and unavailable_dates to Reservations"
```

- [ ] **Step 11: Manual live verification of double-booking prevention (not an automated test)**

With `docker compose up -d db` running and `venv/Scripts/python.exe -m uvicorn app.main:app --reload` started separately, fire two near-simultaneous `POST /items/{item_id}/reservations` requests for the same item and overlapping dates from two different terminals/tools (e.g. two `curl` calls in quick succession, or a small script issuing both without awaiting between them). Confirm exactly one succeeds with `201` and the other receives `409 DATES_UNAVAILABLE`. Record the result as a line in `ROADMAP.md`'s session log when wrapping up this piece of work, the same way the MiniStack S3 round-trip was documented for PR #16.

---

## After this plan

Push `feature/reservations` and open a PR against `develop`. This closes `CLAUDE_BACKEND.md`'s full "Week 2 — Reservations" grouping (6 endpoints) plus the `GET /items` availability wiring. Weeks 3-4 (check-in/out, close, report, transactions history, earnings) are a follow-up piece of work, not part of this plan.
