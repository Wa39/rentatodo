# Weeks 3-4 — Delivery + Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the last 6 endpoints of `CLAUDE_BACKEND.md`'s 22: check-in, check-out, close (with deposit release), report a problem (with deposit freeze), transaction history, and owner earnings.

**Architecture:** Two new models (`CheckEvidence`, `Report`) and one new migration. Check-in/check-out/close/transactions/earnings extend the existing `app/services/reservations.py` + `app/routers/reservations.py` (they're all `Reservation` lifecycle actions or reads). Report gets its own new `app/services/reports.py` + `app/routers/reports.py`, matching `CLAUDE_BACKEND.md`'s file tree, importing the reservation domain's helpers one-directionally (same shape as `items.py` already importing `BLOCKING_STATUSES` from the reservation domain).

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy, Alembic, pytest, PostgreSQL 16 (running via `infra/docker-compose.yml`, already up on `localhost:5432`).

## Global Constraints

- Contract is `packages/contracts/openapi.yaml` — implement to match it exactly (paths already exist: `/reservations/{id}/checkin`, `/checkout`, `/close`, `/report`, `/transactions`, `/users/me/earnings`).
- Every function/class gets a Google-style docstring (what it does, Args, Returns, Raises).
- Every non-obvious Pydantic field gets `Field(..., description="...")`.
- Every new router file gets a module-level docstring.
- Type hints everywhere.
- Every new piece of business logic needs at least one happy-path test and one failure test, under `tests/`, mirroring `app/`'s structure.
- All code, comments, and docstrings in English.
- Freeze transactions carry `amount=reservation.deposit_amount`, not `0` (matches `hold`/`release`).
- `.with_for_update()` is added to `_get_reservation_or_404`'s `SELECT` — every mutating endpoint (existing and new) now holds a row lock.
- `report`'s uniqueness is two layers: an app-level check (`409 REPORT_EXISTS`) plus a `UNIQUE` constraint on `reports.reservation_id` as a database-level safety net (caught as `IntegrityError`).
- `close`'s freeze check reads `Reservation.deposit_status == "frozen"` — no separate query against `reports`.
- No new indexes on `check_evidence` or `reports` — neither table is queried by `reservation_id` in this scope outside `report`'s exists-check, which uses the `UNIQUE` constraint's own index.
- `earnings` is computed in Python (fetch + filter by the existing `deposit_status` property + aggregate), not raw SQL.
- No test touches real S3 — `photo_url` values are plain strings everywhere, `generate_presign` is never invoked in this piece.
- Full reference: `docs/superpowers/specs/2026-07-21-weeks-3-4-delivery-reports-design.md`.

---

### Task 1: `CheckEvidence` + `Report` models and migration

**Files:**
- Create: `apps/api/app/models/check_evidence.py`
- Create: `apps/api/app/models/report.py`
- Modify: `apps/api/app/models/__init__.py`
- Create: `apps/api/alembic/versions/<generated>_create_check_evidence_and_reports_tables.py`
- Test: `apps/api/tests/models/test_check_evidence.py`
- Test: `apps/api/tests/models/test_report.py`

**Interfaces:**
- Consumes: `Base` from `app.database`; `make_user`/`make_item` fixtures (existing, `apps/api/tests/conftest.py`).
- Produces: `CheckEvidence(id, reservation_id, type, photo_url, notes, created_at)` in `app.models.check_evidence`; `Report(id, reservation_id, reported_by, reason, photo_url, created_at)` in `app.models.report`. Both tables exist in the test/dev database after this task. Later tasks import both classes directly by name.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/models/test_check_evidence.py`:

```python
"""Tests for the CheckEvidence model and its database-level constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.check_evidence import CheckEvidence


def test_check_evidence_gets_id_and_created_at(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: a CheckEvidence inserted without setting id/created_at
    still gets sensible values from Postgres.
    """
    owner = make_user(email="checkevidence-owner1@example.com")
    renter = make_user(email="checkevidence-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="approved")

    evidence = CheckEvidence(
        reservation_id=reservation.id,
        type="check_in",
        photo_url="https://example.com/checkin.jpg",
    )
    db_session.add(evidence)
    db_session.commit()
    db_session.refresh(evidence)

    assert evidence.id is not None
    assert evidence.created_at is not None
    assert evidence.notes is None


def test_check_evidence_type_must_be_check_in_or_check_out(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Failure path: the type CHECK constraint is enforced by Postgres,
    not only by application code.
    """
    owner = make_user(email="checkevidence-owner2@example.com")
    renter = make_user(email="checkevidence-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="approved")

    evidence = CheckEvidence(
        reservation_id=reservation.id,
        type="invalid_type",
        photo_url="https://example.com/checkin.jpg",
    )
    db_session.add(evidence)

    with pytest.raises(IntegrityError):
        db_session.commit()
```

Create `apps/api/tests/models/test_report.py`:

```python
"""Tests for the Report model and its database-level constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.report import Report


def test_report_gets_id_and_created_at(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Happy path: a Report inserted without setting id/created_at still
    gets sensible values from Postgres.
    """
    owner = make_user(email="report-owner1@example.com")
    renter = make_user(email="report-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="delivered")

    report = Report(
        reservation_id=reservation.id,
        reported_by=renter.id,
        reason="The drill bit was broken",
        photo_url="https://example.com/broken.jpg",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)

    assert report.id is not None
    assert report.created_at is not None


def test_report_reservation_id_must_be_unique(
    db_session: Session, make_user, make_item, make_reservation
) -> None:
    """Failure path: a second Report for the same reservation violates
    the UNIQUE constraint at the database level — the database-level
    half of "one report per reservation" (app.services.reports.report_problem
    enforces the other half before ever reaching this constraint).
    """
    owner = make_user(email="report-owner2@example.com")
    renter = make_user(email="report-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = make_reservation(item.id, renter.id, status="delivered")
    db_session.add(
        Report(
            reservation_id=reservation.id,
            reported_by=renter.id,
            reason="First report",
            photo_url="https://example.com/first.jpg",
        )
    )
    db_session.commit()

    db_session.add(
        Report(
            reservation_id=reservation.id,
            reported_by=owner.id,
            reason="Second report",
            photo_url="https://example.com/second.jpg",
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/models/test_check_evidence.py tests/models/test_report.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.check_evidence'`

- [ ] **Step 3: Write the models**

Create `apps/api/app/models/check_evidence.py`:

```python
"""SQLAlchemy model for the `check_evidence` table."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CheckEvidence(Base):
    """A photo-evidence record for a Reservation's check-in or check-out,
    per CLAUDE_BACKEND.md. Insert-only — nothing in this codebase ever
    updates or deletes a CheckEvidence row.

    Attributes:
        id: Primary key, generated by Postgres.
        reservation_id: The Reservation this evidence belongs to.
        type: One of check_in/check_out.
        photo_url: Evidence photo URL.
        notes: Optional description of the item's condition.
        created_at: When this evidence was recorded.
    """

    __tablename__ = "check_evidence"
    __table_args__ = (
        CheckConstraint("type IN ('check_in', 'check_out')", name="ck_check_evidence_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reservations.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    photo_url: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

Create `apps/api/app/models/report.py`:

```python
"""SQLAlchemy model for the `reports` table."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Report(Base):
    """A problem report for a Reservation, per CLAUDE_BACKEND.md. Filing
    one freezes the reservation's deposit (see
    app.services.reports.report_problem). At most one Report exists per
    reservation, enforced by the reservation_id UNIQUE constraint below.

    Attributes:
        id: Primary key, generated by Postgres.
        reservation_id: The Reservation being reported. UNIQUE — the
            database-level half of the "one report per reservation"
            rule.
        reported_by: The User (owner or renter) who filed the report.
        reason: Free-text description of the problem.
        photo_url: Required evidence photo URL.
        created_at: When the report was filed.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reservations.id"), nullable=False, unique=True
    )
    reported_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reason: Mapped[str] = mapped_column(String, nullable=False)
    photo_url: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

Modify `apps/api/app/models/__init__.py` (full replacement):

```python
from app.models.check_evidence import CheckEvidence
from app.models.item import Item
from app.models.report import Report
from app.models.reservation import BLOCKING_STATUSES, Reservation, Transaction
from app.models.user import User

__all__ = [
    "BLOCKING_STATUSES",
    "CheckEvidence",
    "Item",
    "Report",
    "Reservation",
    "Transaction",
    "User",
]
```

- [ ] **Step 4: Generate and fill in the migration**

Run (from `apps/api/`, with the venv active and `DATABASE_URL` set):
```bash
alembic revision -m "create check_evidence and reports tables"
```
This prints the path to a new file under `alembic/versions/`, e.g.
`alembic/versions/<hash>_create_check_evidence_and_reports_tables.py`, with
`revision`/`down_revision` already filled in correctly (down_revision will
be `'2bb4c4ef678c'`, the reservations/transactions migration — the current
head). Open that generated file and replace its `upgrade()`/`downgrade()`
functions (leave the `revision`/`down_revision`/`branch_labels`/`depends_on`
lines exactly as generated) with:

```python
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
```

Make sure the file's imports match the existing style (it will already have
`from alembic import op`, `import sqlalchemy as sa`, and needs
`from sqlalchemy.dialects import postgresql` added — check
`alembic/versions/2bb4c4ef678c_create_reservations_and_transactions_.py`
for the exact import block to copy if the generated file doesn't already
include it).

Apply it:
```bash
alembic upgrade head
```
Expected: no errors; `\dt` in `psql` (or `docker compose exec db psql -U rentatodo -d rentatodo -c '\dt'`) now lists `check_evidence` and `reports`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/models/test_check_evidence.py tests/models/test_report.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/models/check_evidence.py apps/api/app/models/report.py apps/api/app/models/__init__.py apps/api/alembic/versions/*_create_check_evidence_and_reports_tables.py apps/api/tests/models/test_check_evidence.py apps/api/tests/models/test_report.py
git commit -m "feat(api): add CheckEvidence and Report models"
```

---

### Task 2: Schemas — `CheckInOutRequest`, `CreateReportRequest`/`ReportResponse`, `TransactionResponse`, `EarningsResponse`

**Files:**
- Create: `apps/api/app/schemas/check_evidence.py`
- Create: `apps/api/app/schemas/report.py`
- Create: `apps/api/app/schemas/transaction.py`
- Create: `apps/api/app/schemas/earnings.py`
- Test: `apps/api/tests/schemas/test_check_evidence.py`
- Test: `apps/api/tests/schemas/test_report.py`
- Test: `apps/api/tests/schemas/test_transaction.py`
- Test: `apps/api/tests/schemas/test_earnings.py`

**Interfaces:**
- Consumes: nothing from Task 1 (these are leaf Pydantic schemas, no model imports).
- Produces: `CheckInOutRequest(photo_url: str, notes: str | None)`; `CreateReportRequest(reason: str, photo_url: str)`, `ReportResponse(id: UUID, reservation_id: UUID, reported_by: UUID, reason: str, photo_url: str, created_at: datetime)`; `TransactionTypeEnum(str, Enum)` with `HOLD`/`RELEASE`/`FREEZE`, `TransactionResponse(id, reservation_id, type: TransactionTypeEnum, amount: int, created_at)`; `EarningsRental(start_date: date, end_date: date, amount: int)`, `EarningsByItem(item_id: UUID, item_name: str, total: int, rentals: list[EarningsRental])`, `EarningsResponse(total_earnings: int, by_item: list[EarningsByItem])`. Tasks 4-7 import these by name.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/schemas/test_check_evidence.py`:

```python
"""Tests for the CheckInOutRequest schema."""

import pytest
from pydantic import ValidationError

from app.schemas.check_evidence import CheckInOutRequest


def test_check_in_out_request_accepts_photo_url_only() -> None:
    """Happy path: notes is optional, defaults to None."""
    request = CheckInOutRequest(photo_url="https://example.com/photo.jpg")

    assert request.photo_url == "https://example.com/photo.jpg"
    assert request.notes is None


def test_check_in_out_request_accepts_notes() -> None:
    """Happy path: notes is stored as given when provided."""
    request = CheckInOutRequest(
        photo_url="https://example.com/photo.jpg",
        notes="Received with case and 3 drill bits",
    )

    assert request.notes == "Received with case and 3 drill bits"


def test_check_in_out_request_requires_photo_url() -> None:
    """Failure path: photo_url is required."""
    with pytest.raises(ValidationError):
        CheckInOutRequest(notes="No photo attached")
```

Create `apps/api/tests/schemas/test_report.py`:

```python
"""Tests for the Report Pydantic schemas."""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.report import CreateReportRequest, ReportResponse


def test_create_report_request_happy_path() -> None:
    """Happy path: reason and photo_url are both required and stored as given."""
    request = CreateReportRequest(
        reason="The drill bit was broken when I received it",
        photo_url="https://example.com/broken.jpg",
    )

    assert request.reason == "The drill bit was broken when I received it"
    assert request.photo_url == "https://example.com/broken.jpg"


def test_create_report_request_rejects_empty_reason() -> None:
    """Failure path: reason must be at least 1 character."""
    with pytest.raises(ValidationError):
        CreateReportRequest(reason="", photo_url="https://example.com/broken.jpg")


def test_report_response_round_trip() -> None:
    """Happy path: ReportResponse holds every field as given."""
    response = ReportResponse(
        id=uuid4(),
        reservation_id=uuid4(),
        reported_by=uuid4(),
        reason="Broken item",
        photo_url="https://example.com/broken.jpg",
        created_at=datetime.now(),
    )

    assert response.reason == "Broken item"
```

Create `apps/api/tests/schemas/test_transaction.py`:

```python
"""Tests for the Transaction Pydantic schema."""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.transaction import TransactionResponse


def test_transaction_response_accepts_each_valid_type() -> None:
    """Happy path: each of the three ledger types validates."""
    for tx_type in ("hold", "release", "freeze"):
        response = TransactionResponse(
            id=uuid4(),
            reservation_id=uuid4(),
            type=tx_type,
            amount=15000,
            created_at=datetime.now(),
        )
        assert response.type.value == tx_type


def test_transaction_response_rejects_invalid_type() -> None:
    """Failure path: a type outside hold/release/freeze is rejected."""
    with pytest.raises(ValidationError):
        TransactionResponse(
            id=uuid4(),
            reservation_id=uuid4(),
            type="refund",
            amount=15000,
            created_at=datetime.now(),
        )
```

Create `apps/api/tests/schemas/test_earnings.py`:

```python
"""Tests for the Earnings Pydantic schemas."""

from datetime import date
from uuid import uuid4

from app.schemas.earnings import EarningsByItem, EarningsResponse, EarningsRental


def test_earnings_response_round_trip() -> None:
    """Happy path: a full nested EarningsResponse builds and holds its
    values as given.
    """
    response = EarningsResponse(
        total_earnings=30000,
        by_item=[
            EarningsByItem(
                item_id=uuid4(),
                item_name="Taladro Bosch",
                total=30000,
                rentals=[
                    EarningsRental(
                        start_date=date(2026, 8, 1), end_date=date(2026, 8, 3), amount=15000
                    ),
                    EarningsRental(
                        start_date=date(2026, 8, 10), end_date=date(2026, 8, 12), amount=15000
                    ),
                ],
            )
        ],
    )

    assert response.total_earnings == 30000
    assert len(response.by_item[0].rentals) == 2


def test_earnings_response_empty_by_item() -> None:
    """Edge path: an owner with no closed+released reservations gets an
    empty by_item list and zero total, not an error.
    """
    response = EarningsResponse(total_earnings=0, by_item=[])

    assert response.total_earnings == 0
    assert response.by_item == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/schemas/test_check_evidence.py tests/schemas/test_report.py tests/schemas/test_transaction.py tests/schemas/test_earnings.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.check_evidence'`

- [ ] **Step 3: Write the schemas**

Create `apps/api/app/schemas/check_evidence.py`:

```python
"""Pydantic schema for check-in/check-out requests. Mirrors
packages/contracts/openapi.yaml's CheckInOutRequest exactly.
"""

from pydantic import BaseModel, Field


class CheckInOutRequest(BaseModel):
    """Payload for POST /reservations/{reservation_id}/checkin and
    .../checkout.
    """

    photo_url: str = Field(..., description="Photo evidence of item condition.")
    notes: str | None = Field(
        default=None, description="Optional notes about the item condition."
    )
```

Create `apps/api/app/schemas/report.py`:

```python
"""Pydantic schemas for the Reports endpoint. Mirrors
packages/contracts/openapi.yaml's CreateReportRequest/ReportResponse exactly.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateReportRequest(BaseModel):
    """Payload for POST /reservations/{reservation_id}/report."""

    reason: str = Field(
        ..., min_length=1, description="Free text description of the problem."
    )
    photo_url: str = Field(..., description="Required photo evidence of the problem.")


class ReportResponse(BaseModel):
    """Public report representation, as returned by POST .../report."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    reported_by: UUID
    reason: str
    photo_url: str
    created_at: datetime
```

Create `apps/api/app/schemas/transaction.py`:

```python
"""Pydantic schemas for Transactions. Mirrors
packages/contracts/openapi.yaml's TransactionResponse exactly.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TransactionTypeEnum(str, Enum):
    """The three transaction types in the deposit ledger."""

    HOLD = "hold"
    RELEASE = "release"
    FREEZE = "freeze"


class TransactionResponse(BaseModel):
    """Public transaction representation, as returned by
    GET /reservations/{reservation_id}/transactions.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    type: TransactionTypeEnum
    amount: int
    created_at: datetime
```

Create `apps/api/app/schemas/earnings.py`:

```python
"""Pydantic schemas for GET /users/me/earnings. Mirrors
packages/contracts/openapi.yaml's EarningsResponse exactly.
"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class EarningsRental(BaseModel):
    """One closed-and-paid-out rental of an item, within an
    EarningsByItem entry.
    """

    start_date: date
    end_date: date
    amount: int


class EarningsByItem(BaseModel):
    """One item's earnings breakdown, within an EarningsResponse."""

    item_id: UUID
    item_name: str
    total: int
    rentals: list[EarningsRental]


class EarningsResponse(BaseModel):
    """Owner earnings summary, as returned by GET /users/me/earnings."""

    total_earnings: int
    by_item: list[EarningsByItem]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/schemas/test_check_evidence.py tests/schemas/test_report.py tests/schemas/test_transaction.py tests/schemas/test_earnings.py -v`
Expected: PASS (10 passed)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/check_evidence.py apps/api/app/schemas/report.py apps/api/app/schemas/transaction.py apps/api/app/schemas/earnings.py apps/api/tests/schemas/test_check_evidence.py apps/api/tests/schemas/test_report.py apps/api/tests/schemas/test_transaction.py apps/api/tests/schemas/test_earnings.py
git commit -m "feat(api): add check evidence, report, transaction, earnings schemas"
```

---

### Task 3: Row lock + `_assert_participant` helper

**Files:**
- Modify: `apps/api/app/services/reservations.py` (the `_get_reservation_or_404` function, and a new `_assert_participant` function added after it)
- Test: `apps/api/tests/services/test_reservations.py` (append)

**Interfaces:**
- Consumes: `Reservation` (existing).
- Produces: `_assert_participant(reservation: Reservation, user_id: uuid.UUID) -> None` (raises `AppError` 403 `FORBIDDEN` if `user_id` is neither `reservation.renter_id` nor `reservation.item.owner_id`). `_get_reservation_or_404` behaves identically to before except its `SELECT` now takes a row lock. Tasks 4-7 both rely on `_assert_participant` existing in `app.services.reservations` and on `_get_reservation_or_404` being lock-safe to call from `close_reservation`/`report_problem`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/tests/services/test_reservations.py` (the `event` import below is local to the test function, matching this file's existing convention of importing service functions inline per test rather than at module level):

```python
def test_get_reservation_or_404_locks_the_row(db_session: Session, make_user, make_item) -> None:
    """The lookup used by every mutating endpoint takes a row lock
    (FOR UPDATE), so two concurrent calls on the same reservation can't
    both pass a status check before either commits.
    """
    from sqlalchemy import event

    from app.services import reservations
    from app.services.reservations import create_reservation

    owner = make_user(email="lock-owner1@example.com")
    renter = make_user(email="lock-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    captured_sql = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        captured_sql.append(statement)

    event.listen(db_session.get_bind(), "before_cursor_execute", _capture)
    try:
        reservations._get_reservation_or_404(db_session, reservation.id)
    finally:
        event.remove(db_session.get_bind(), "before_cursor_execute", _capture)

    assert any("FOR UPDATE" in sql.upper() for sql in captured_sql)


def test_assert_participant_allows_renter_and_owner(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: both the renter and the item's owner satisfy the check."""
    from app.services.reservations import _assert_participant, create_reservation

    owner = make_user(email="participant-owner1@example.com")
    renter = make_user(email="participant-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    _assert_participant(reservation, renter.id)
    _assert_participant(reservation, owner.id)


def test_assert_participant_rejects_third_party(db_session: Session, make_user, make_item) -> None:
    """Failure path: a user who is neither the renter nor the owner is
    403 FORBIDDEN.
    """
    from app.services.reservations import _assert_participant, create_reservation

    owner = make_user(email="participant-owner2@example.com")
    renter = make_user(email="participant-renter2@example.com")
    stranger = make_user(email="participant-stranger2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    with pytest.raises(AppError) as exc_info:
        _assert_participant(reservation, stranger.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -k "locks_the_row or assert_participant" -v`
Expected: FAIL — the row-lock test fails because `"FOR UPDATE"` isn't in the captured SQL yet; the `_assert_participant` tests fail with `ImportError: cannot import name '_assert_participant'`.

- [ ] **Step 3: Add the row lock and the helper**

In `apps/api/app/services/reservations.py`, replace the existing `_get_reservation_or_404` function (including its comment block) with:

```python
def _get_reservation_or_404(db: Session, reservation_id: uuid.UUID) -> Reservation:
    """Look up a reservation by id, with its item and renter pre-loaded,
    holding a row lock for the rest of the caller's transaction.

    Args:
        db: Database session.
        reservation_id: The reservation's id.

    Returns:
        The matching Reservation.

    Raises:
        AppError: 404 NOT_FOUND if no reservation exists with that id.
    """
    # .with_for_update() added now that close_reservation and
    # report_problem insert real ledger entries (release/freeze) whose
    # ordering matters — see design spec 2026-07-21. Two concurrent
    # calls on the same reservation can no longer both pass a status
    # check before either commits.
    reservation = db.scalar(
        select(Reservation)
        .options(joinedload(Reservation.item), joinedload(Reservation.renter))
        .where(Reservation.id == reservation_id)
        .with_for_update()
    )
    if reservation is None:
        raise AppError(404, "NOT_FOUND", "Reservation not found")
    return reservation


def _assert_participant(reservation: Reservation, user_id: uuid.UUID) -> None:
    """Ensure the caller is either the reservation's renter or the
    rented item's owner.

    Args:
        reservation: The reservation being accessed.
        user_id: The authenticated caller's id.

    Raises:
        AppError: 403 FORBIDDEN if the caller is neither party.
    """
    if user_id != reservation.renter_id and user_id != reservation.item.owner_id:
        raise AppError(403, "FORBIDDEN", "You are not a party to this reservation")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py -v`
Expected: PASS, full file green (existing approve/reject/cancel/create/list tests unaffected — this is a regression check that the row lock doesn't change any existing behavior)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/reservations.py apps/api/tests/services/test_reservations.py
git commit -m "feat(api): add row lock to reservation lookup and an _assert_participant helper"
```

---

### Task 4: Check-in / check-out

**Files:**
- Modify: `apps/api/app/services/reservations.py` (add `checkin_reservation`, `checkout_reservation`; add imports for `CheckEvidence` and `CheckInOutRequest`)
- Modify: `apps/api/app/routers/reservations.py` (add the two endpoints and their imports)
- Test: `apps/api/tests/services/test_reservations.py` (append; add `from app.schemas.check_evidence import CheckInOutRequest` to imports)
- Test: `apps/api/tests/routers/test_reservations.py` (append)

**Interfaces:**
- Consumes: `_get_reservation_or_404` (Task 3), `CheckEvidence` (Task 1), `CheckInOutRequest` (Task 2).
- Produces: `checkin_reservation(db, reservation_id, renter_id, data: CheckInOutRequest) -> Reservation`, `checkout_reservation(db, reservation_id, renter_id, data: CheckInOutRequest) -> Reservation` in `app.services.reservations`. Task 5 does not depend on these; Task 6/7 don't either — independent leaves of the reservation lifecycle.

- [ ] **Step 1: Write the failing tests**

Add to the top imports of `apps/api/tests/services/test_reservations.py`:
```python
from app.schemas.check_evidence import CheckInOutRequest
```

Append to `apps/api/tests/services/test_reservations.py`:

```python
def test_checkin_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: checking in an approved reservation moves it to
    delivered and records CheckEvidence.
    """
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        create_reservation,
    )

    owner = make_user(email="checkin-owner1@example.com")
    renter = make_user(email="checkin-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    checked_in = checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
    )

    assert checked_in.status == "delivered"


def test_checkin_reservation_requires_renter(db_session: Session, make_user, make_item) -> None:
    """Failure path: the item's owner can't check in on the renter's
    behalf, 403 FORBIDDEN.
    """
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        create_reservation,
    )

    owner = make_user(email="checkin-owner2@example.com")
    renter = make_user(email="checkin-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        checkin_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=owner.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_checkin_reservation_requires_approved_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: checking in a still-requested reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import checkin_reservation, create_reservation

    owner = make_user(email="checkin-owner3@example.com")
    renter = make_user(email="checkin-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    with pytest.raises(AppError) as exc_info:
        checkin_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=renter.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_checkout_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: checking out a delivered reservation moves it to returned."""
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        create_reservation,
    )

    owner = make_user(email="checkout-owner1@example.com")
    renter = make_user(email="checkout-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
    )

    checked_out = checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkout.jpg"),
    )

    assert checked_out.status == "returned"


def test_checkout_reservation_requires_renter(db_session: Session, make_user, make_item) -> None:
    """Failure path: the item's owner can't check out on the renter's
    behalf, 403 FORBIDDEN.
    """
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        create_reservation,
    )

    owner = make_user(email="checkout-owner2@example.com")
    renter = make_user(email="checkout-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/checkin.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        checkout_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=owner.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkout.jpg"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_checkout_reservation_requires_delivered_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: checking out a still-approved reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import (
        approve_reservation,
        checkout_reservation,
        create_reservation,
    )

    owner = make_user(email="checkout-owner3@example.com")
    renter = make_user(email="checkout-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        checkout_reservation(
            db_session,
            reservation_id=reservation.id,
            renter_id=renter.id,
            data=CheckInOutRequest(photo_url="https://example.com/checkout.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"
```

Append to `apps/api/tests/routers/test_reservations.py`:

```python
def test_checkin_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the renter checks in an approved reservation."""
    owner_token = _register_and_login(client, "resrouter-owner-checkin1@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter-checkin1@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=25)),
            "end_date": str(date.today() + timedelta(days=26)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    response = client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "delivered"


def test_checkin_endpoint_forbidden_for_owner(client: TestClient) -> None:
    """Failure path: the item's owner can't check in, 403 FORBIDDEN."""
    owner_token = _register_and_login(client, "resrouter-owner-checkin2@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter-checkin2@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=27)),
            "end_date": str(date.today() + timedelta(days=28)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    response = client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_checkout_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the renter checks out a delivered reservation."""
    owner_token = _register_and_login(client, "resrouter-owner-checkout1@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter-checkout1@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=29)),
            "end_date": str(date.today() + timedelta(days=30)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )

    response = client.post(
        f"/reservations/{reservation_id}/checkout",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkout.jpg"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "returned"


def test_checkout_endpoint_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.post(
        "/reservations/00000000-0000-0000-0000-000000000000/checkout",
        json={"photo_url": "https://example.com/checkout.jpg"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py tests/routers/test_reservations.py -k "checkin or checkout" -v`
Expected: FAIL with `ImportError: cannot import name 'checkin_reservation'` (services) and `404` for the router tests (routes don't exist yet)

- [ ] **Step 3: Implement checkin/checkout**

In `apps/api/app/services/reservations.py`, add to the imports at the top:
```python
from app.models.check_evidence import CheckEvidence
from app.schemas.check_evidence import CheckInOutRequest
```

Add these two functions (after `create_reservation`, before `_get_reservation_or_404`, or anywhere below the imports — order among top-level functions doesn't matter):

```python
def checkin_reservation(
    db: Session, reservation_id: uuid.UUID, renter_id: uuid.UUID, data: CheckInOutRequest
) -> Reservation:
    """Renter checks in an approved reservation, recording photo evidence.

    Args:
        db: Database session.
        reservation_id: The reservation to check in.
        renter_id: The authenticated caller's id — must be the
            reservation's renter.
        data: The check-in photo_url and optional notes.

    Returns:
        The reservation, now "delivered".

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't its renter. 409
            INVALID_TRANSITION if the reservation isn't "approved".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.renter_id != renter_id:
        raise AppError(403, "FORBIDDEN", "You are not the renter for this reservation")
    if reservation.status != "approved":
        raise AppError(
            409, "INVALID_TRANSITION", "Only an approved reservation can be checked in"
        )

    reservation.status = "delivered"
    db.add(
        CheckEvidence(
            reservation_id=reservation.id,
            type="check_in",
            photo_url=data.photo_url,
            notes=data.notes,
        )
    )
    db.commit()
    db.refresh(reservation)
    return reservation


def checkout_reservation(
    db: Session, reservation_id: uuid.UUID, renter_id: uuid.UUID, data: CheckInOutRequest
) -> Reservation:
    """Renter checks out a delivered reservation, recording photo evidence.

    Args:
        db: Database session.
        reservation_id: The reservation to check out.
        renter_id: The authenticated caller's id — must be the
            reservation's renter.
        data: The check-out photo_url and optional notes.

    Returns:
        The reservation, now "returned".

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't its renter. 409
            INVALID_TRANSITION if the reservation isn't "delivered".
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.renter_id != renter_id:
        raise AppError(403, "FORBIDDEN", "You are not the renter for this reservation")
    if reservation.status != "delivered":
        raise AppError(
            409, "INVALID_TRANSITION", "Only a delivered reservation can be checked out"
        )

    reservation.status = "returned"
    db.add(
        CheckEvidence(
            reservation_id=reservation.id,
            type="check_out",
            photo_url=data.photo_url,
            notes=data.notes,
        )
    )
    db.commit()
    db.refresh(reservation)
    return reservation
```

In `apps/api/app/routers/reservations.py`, update the imports:

```python
from app.schemas.check_evidence import CheckInOutRequest
```
(add this line near the other `app.schemas` import)

```python
from app.services.reservations import (
    approve_reservation,
    cancel_reservation,
    checkin_reservation,
    checkout_reservation,
    create_reservation,
    list_my_requests,
    list_my_reservations,
    reject_reservation,
)
```
(replace the existing `from app.services.reservations import (...)` block with this one)

Add these two endpoints (after `create_reservation_endpoint`, anywhere below the other routes is fine):

```python
@router.post("/reservations/{reservation_id}/checkin", status_code=201)
def checkin_reservation_endpoint(
    reservation_id: UUID,
    data: CheckInOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Renter checks in an approved reservation with photo evidence.

    Args:
        reservation_id: The reservation to check in.
        data: The check-in photo_url and optional notes.
        current_user: Resolved by get_current_user — must be the
            reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The reservation's public representation, now "delivered".
    """
    reservation = checkin_reservation(
        db, reservation_id=reservation_id, renter_id=current_user.id, data=data
    )
    return ReservationResponse.model_validate(reservation)


@router.post("/reservations/{reservation_id}/checkout", status_code=201)
def checkout_reservation_endpoint(
    reservation_id: UUID,
    data: CheckInOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Renter checks out a delivered reservation with photo evidence.

    Args:
        reservation_id: The reservation to check out.
        data: The check-out photo_url and optional notes.
        current_user: Resolved by get_current_user — must be the
            reservation's renter.
        db: Database session injected by FastAPI.

    Returns:
        The reservation's public representation, now "returned".
    """
    reservation = checkout_reservation(
        db, reservation_id=reservation_id, renter_id=current_user.id, data=data
    )
    return ReservationResponse.model_validate(reservation)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py tests/routers/test_reservations.py -v`
Expected: PASS, full files green

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/reservations.py apps/api/app/routers/reservations.py apps/api/tests/services/test_reservations.py apps/api/tests/routers/test_reservations.py
git commit -m "feat(api): add checkin/checkout endpoints"
```

---

### Task 5: Close (with deposit release)

**Files:**
- Modify: `apps/api/app/services/reservations.py` (add `close_reservation`)
- Modify: `apps/api/app/routers/reservations.py` (add the endpoint and its import)
- Test: `apps/api/tests/services/test_reservations.py` (append)
- Test: `apps/api/tests/routers/test_reservations.py` (append)

**Interfaces:**
- Consumes: `_get_reservation_or_404` (Task 3), `checkin_reservation`/`checkout_reservation` (Task 4, used only inside tests to reach the `returned` state), `Transaction` (existing).
- Produces: `close_reservation(db, reservation_id, owner_id) -> Reservation` in `app.services.reservations`. Nothing later in this plan depends on it directly.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/tests/services/test_reservations.py`:

```python
def test_close_reservation_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: closing a returned reservation releases the deposit."""
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    owner = make_user(email="close-owner1@example.com")
    renter = make_user(email="close-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )

    closed = close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert closed.status == "closed"
    assert closed.deposit_status == "released"


def test_close_reservation_requires_ownership(db_session: Session, make_user, make_item) -> None:
    """Failure path: a non-owner can't close, 403 FORBIDDEN."""
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    owner = make_user(email="close-owner2@example.com")
    renter = make_user(email="close-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        close_reservation(db_session, reservation_id=reservation.id, owner_id=renter.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_close_reservation_requires_returned_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: closing a still-requested reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reservations import close_reservation, create_reservation

    owner = make_user(email="close-owner3@example.com")
    renter = make_user(email="close-renter3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    with pytest.raises(AppError) as exc_info:
        close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_close_reservation_blocked_by_active_freeze(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a returned reservation with an active freeze (open
    problem report) can't be closed, 409 FREEZE_ACTIVE. The freeze
    transaction is inserted directly here — report_problem (Task 6)
    doesn't exist yet, and close_reservation's check only reads
    deposit_status, never the reports table (see design spec).
    """
    from app.models.reservation import Transaction
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    owner = make_user(email="close-owner4@example.com")
    renter = make_user(email="close-renter4@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )
    db_session.add(
        Transaction(
            reservation_id=reservation.id, type="freeze", amount=reservation.deposit_amount
        )
    )
    db_session.commit()

    with pytest.raises(AppError) as exc_info:
        close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "FREEZE_ACTIVE"
```

Append to `apps/api/tests/routers/test_reservations.py`:

```python
def test_close_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the owner closes a returned reservation, deposit
    becomes released.
    """
    owner_token = _register_and_login(client, "resrouter-owner-close1@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter-close1@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=31)),
            "end_date": str(date.today() + timedelta(days=32)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkout",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkout.jpg"},
    )

    response = client.patch(
        f"/reservations/{reservation_id}/close",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "closed"
    assert body["deposit_status"] == "released"


def test_close_endpoint_forbidden_for_renter(client: TestClient) -> None:
    """Failure path: the renter can't close, 403 FORBIDDEN."""
    owner_token = _register_and_login(client, "resrouter-owner-close2@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter-close2@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=33)),
            "end_date": str(date.today() + timedelta(days=34)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkout",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkout.jpg"},
    )

    response = client.patch(
        f"/reservations/{reservation_id}/close",
        headers={"Authorization": f"Bearer {renter_token}"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py tests/routers/test_reservations.py -k close -v`
Expected: FAIL with `ImportError: cannot import name 'close_reservation'` (services) and `404` (router)

- [ ] **Step 3: Implement close**

In `apps/api/app/services/reservations.py`, add:

```python
def close_reservation(db: Session, reservation_id: uuid.UUID, owner_id: uuid.UUID) -> Reservation:
    """Owner closes a returned reservation, releasing the deposit.

    Args:
        db: Database session.
        reservation_id: The reservation to close.
        owner_id: The authenticated caller's id — must be the item's owner.

    Returns:
        The closed Reservation, with a "release" Transaction inserted.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller isn't the item's owner. 409
            INVALID_TRANSITION if the reservation isn't "returned". 409
            FREEZE_ACTIVE if an open problem report exists (deposit is
            frozen).
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    if reservation.item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")
    if reservation.status != "returned":
        raise AppError(409, "INVALID_TRANSITION", "Only a returned reservation can be closed")
    if reservation.deposit_status == "frozen":
        raise AppError(
            409, "FREEZE_ACTIVE", "Cannot close a reservation with an open problem report"
        )

    reservation.status = "closed"
    db.add(
        Transaction(reservation_id=reservation.id, type="release", amount=reservation.deposit_amount)
    )
    db.commit()
    db.refresh(reservation)
    return reservation
```

In `apps/api/app/routers/reservations.py`, replace the `from app.services.reservations import (...)` block with:

```python
from app.services.reservations import (
    approve_reservation,
    cancel_reservation,
    checkin_reservation,
    checkout_reservation,
    close_reservation,
    create_reservation,
    list_my_requests,
    list_my_reservations,
    reject_reservation,
)
```

and add the endpoint:

```python
@router.patch("/reservations/{reservation_id}/close")
def close_reservation_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReservationResponse:
    """Owner closes a returned reservation, releasing the deposit.

    Args:
        reservation_id: The reservation to close.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The closed reservation's public representation.
    """
    reservation = close_reservation(db, reservation_id=reservation_id, owner_id=current_user.id)
    return ReservationResponse.model_validate(reservation)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py tests/routers/test_reservations.py -v`
Expected: PASS, full files green

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/reservations.py apps/api/app/routers/reservations.py apps/api/tests/services/test_reservations.py apps/api/tests/routers/test_reservations.py
git commit -m "feat(api): add close endpoint with deposit release"
```

---

### Task 6: Report a problem

**Files:**
- Create: `apps/api/app/services/reports.py`
- Create: `apps/api/app/routers/reports.py`
- Modify: `apps/api/app/main.py` (wire the new router)
- Test: `apps/api/tests/services/test_reports.py`
- Test: `apps/api/tests/routers/test_reports.py`

**Interfaces:**
- Consumes: `_get_reservation_or_404`, `_assert_participant` (both Task 3, imported from `app.services.reservations`), `Report` (Task 1), `Transaction` (existing), `CreateReportRequest`/`ReportResponse` (Task 2).
- Produces: `report_problem(db, reservation_id, reporter_id, data: CreateReportRequest) -> Report` in `app.services.reports`. Nothing later in this plan depends on it.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/services/test_reports.py`:

```python
"""Tests for app.services.reports: report_problem."""

from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.schemas.check_evidence import CheckInOutRequest
from app.schemas.report import CreateReportRequest
from app.schemas.reservation import CreateReservationRequest


def _dates(start_offset: int, days: int) -> CreateReservationRequest:
    start = date.today() + timedelta(days=start_offset)
    end = start + timedelta(days=days - 1)
    return CreateReservationRequest(start_date=start, end_date=end)


def _make_delivered_reservation(db_session: Session, owner, renter, item):
    from app.services.reservations import approve_reservation, checkin_reservation, create_reservation

    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    return checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )


def test_report_problem_happy_path_by_renter(db_session: Session, make_user, make_item) -> None:
    """Happy path: the renter reports a problem, deposit becomes frozen,
    status does not change.
    """
    from app.services.reports import report_problem

    owner = make_user(email="report-owner1@example.com")
    renter = make_user(email="report-renter1@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    report = report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="Item arrived damaged", photo_url="https://example.com/damaged.jpg"),
    )

    assert report.reason == "Item arrived damaged"
    db_session.refresh(reservation)
    assert reservation.deposit_status == "frozen"
    assert reservation.status == "delivered"


def test_report_problem_happy_path_by_owner(db_session: Session, make_user, make_item) -> None:
    """Happy path: the owner can also report a problem, not just the renter."""
    from app.services.reports import report_problem

    owner = make_user(email="report-owner2@example.com")
    renter = make_user(email="report-renter2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    report = report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=owner.id,
        data=CreateReportRequest(reason="Renter returned it broken", photo_url="https://example.com/broken.jpg"),
    )

    assert report.reported_by == owner.id


def test_report_problem_requires_participant(db_session: Session, make_user, make_item) -> None:
    """Failure path: a stranger can't file a report, 403 FORBIDDEN."""
    from app.services.reports import report_problem

    owner = make_user(email="report-owner3@example.com")
    renter = make_user(email="report-renter3@example.com")
    stranger = make_user(email="report-stranger3@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)

    with pytest.raises(AppError) as exc_info:
        report_problem(
            db_session,
            reservation_id=reservation.id,
            reporter_id=stranger.id,
            data=CreateReportRequest(reason="Not my business", photo_url="https://example.com/x.jpg"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_report_problem_requires_delivered_or_returned_status(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: reporting a still-requested reservation is 409
    INVALID_TRANSITION.
    """
    from app.services.reports import report_problem
    from app.services.reservations import create_reservation

    owner = make_user(email="report-owner4@example.com")
    renter = make_user(email="report-renter4@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )

    with pytest.raises(AppError) as exc_info:
        report_problem(
            db_session,
            reservation_id=reservation.id,
            reporter_id=renter.id,
            data=CreateReportRequest(reason="Too early", photo_url="https://example.com/x.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_TRANSITION"


def test_report_problem_rejects_duplicate_report(db_session: Session, make_user, make_item) -> None:
    """Failure path: a second report on the same reservation is 409
    REPORT_EXISTS.
    """
    from app.services.reports import report_problem

    owner = make_user(email="report-owner5@example.com")
    renter = make_user(email="report-renter5@example.com")
    item = make_item(owner_id=owner.id)
    reservation = _make_delivered_reservation(db_session, owner, renter, item)
    report_problem(
        db_session,
        reservation_id=reservation.id,
        reporter_id=renter.id,
        data=CreateReportRequest(reason="First problem", photo_url="https://example.com/first.jpg"),
    )

    with pytest.raises(AppError) as exc_info:
        report_problem(
            db_session,
            reservation_id=reservation.id,
            reporter_id=owner.id,
            data=CreateReportRequest(reason="Second problem", photo_url="https://example.com/second.jpg"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "REPORT_EXISTS"
```

Create `apps/api/tests/routers/test_reports.py`:

```python
"""Integration tests for the Reports endpoint."""

from datetime import date, timedelta

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Test User", "email": email, "password": "securepass123"},
    )
    login = client.post("/auth/login", json={"email": email, "password": "securepass123"})
    return login.json()["access_token"]


def _create_item(client: TestClient, token: str) -> str:
    response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Taladro Bosch",
            "description": "Percutor profesional",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    return response.json()["id"]


def test_report_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: the renter reports a problem on a delivered reservation."""
    owner_token = _register_and_login(client, "reportsrouter-owner1@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter1@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=40)),
            "end_date": str(date.today() + timedelta(days=41)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )

    response = client.post(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"reason": "Item arrived damaged", "photo_url": "https://example.com/damaged.jpg"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["reason"] == "Item arrived damaged"


def test_report_endpoint_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.post(
        "/reservations/00000000-0000-0000-0000-000000000000/report",
        json={"reason": "x", "photo_url": "https://example.com/x.jpg"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reports.py tests/routers/test_reports.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.reports'`

- [ ] **Step 3: Implement report_problem**

Create `apps/api/app/services/reports.py`:

```python
"""Business logic for Reports: filing a problem report, which freezes
the reservation's deposit.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppError
from app.models.report import Report
from app.models.reservation import Transaction
from app.schemas.report import CreateReportRequest
from app.services.reservations import _assert_participant, _get_reservation_or_404


def report_problem(
    db: Session, reservation_id: uuid.UUID, reporter_id: uuid.UUID, data: CreateReportRequest
) -> Report:
    """File a problem report against a reservation, freezing its deposit.

    Args:
        db: Database session.
        reservation_id: The reservation being reported.
        reporter_id: The authenticated caller's id — must be the
            reservation's renter or the item's owner.
        data: The report's reason and photo_url.

    Returns:
        The newly created Report. The reservation's status does NOT change.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller is neither the renter nor the owner.
            409 INVALID_TRANSITION if the reservation isn't "delivered"
            or "returned". 409 REPORT_EXISTS if a report already exists
            for this reservation.
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    _assert_participant(reservation, reporter_id)
    if reservation.status not in ("delivered", "returned"):
        raise AppError(
            409, "INVALID_TRANSITION", "Can only report a delivered or returned reservation"
        )

    existing = db.scalar(select(Report.id).where(Report.reservation_id == reservation_id))
    if existing is not None:
        raise AppError(409, "REPORT_EXISTS", "This reservation already has a report")

    report = Report(
        reservation_id=reservation_id,
        reported_by=reporter_id,
        reason=data.reason,
        photo_url=data.photo_url,
    )
    db.add(report)
    db.add(
        Transaction(
            reservation_id=reservation_id, type="freeze", amount=reservation.deposit_amount
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "REPORT_EXISTS", "This reservation already has a report")
    db.refresh(report)
    return report
```

Create `apps/api/app/routers/reports.py`:

```python
"""Reports endpoint: file a problem report against a reservation."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.report import CreateReportRequest, ReportResponse
from app.services.reports import report_problem

router = APIRouter()


@router.post("/reservations/{reservation_id}/report", status_code=201)
def report_problem_endpoint(
    reservation_id: UUID,
    data: CreateReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    """File a problem report against a reservation, freezing its deposit.

    Args:
        reservation_id: The reservation being reported.
        data: The report's reason and photo_url.
        current_user: Resolved by get_current_user — must be the
            reservation's renter or the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The newly created report's public representation.
    """
    report = report_problem(
        db, reservation_id=reservation_id, reporter_id=current_user.id, data=data
    )
    return ReportResponse.model_validate(report)
```

Modify `apps/api/app/main.py`:

Change:
```python
from app.routers import auth, health, items, reservations
```
to:
```python
from app.routers import auth, health, items, reports, reservations
```

Change:
```python
app.include_router(reservations.router)
```
to:
```python
app.include_router(reservations.router)
app.include_router(reports.router)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reports.py tests/routers/test_reports.py -v`
Expected: PASS (5 + 2 passed)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/reports.py apps/api/app/routers/reports.py apps/api/app/main.py apps/api/tests/services/test_reports.py apps/api/tests/routers/test_reports.py
git commit -m "feat(api): add report-a-problem endpoint"
```

---

### Task 7: Transaction history + earnings

**Files:**
- Modify: `apps/api/app/services/reservations.py` (add `get_transactions`, `get_earnings`, and the `app.schemas.earnings` import)
- Modify: `apps/api/app/routers/reservations.py` (add the two endpoints and their imports)
- Test: `apps/api/tests/services/test_reservations.py` (append)
- Test: `apps/api/tests/routers/test_reservations.py` (append)

**Interfaces:**
- Consumes: `_get_reservation_or_404`, `_assert_participant` (Task 3), `TransactionResponse` (Task 2, used only in the router), `EarningsResponse`/`EarningsByItem`/`EarningsRental` (Task 2), `close_reservation`/`checkin_reservation`/`checkout_reservation` (Tasks 4-5, used only inside tests to reach a `closed` reservation).
- Produces: `get_transactions(db, reservation_id, user_id) -> list[Transaction]`, `get_earnings(db, owner_id) -> EarningsResponse`, both in `app.services.reservations`. Nothing later in this plan depends on them — last task.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/tests/services/test_reservations.py`:

```python
def test_get_transactions_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: after approving, the reservation has one hold transaction."""
    from app.services.reservations import approve_reservation, create_reservation, get_transactions

    owner = make_user(email="transactions-owner1@example.com")
    renter = make_user(email="transactions-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    transactions = get_transactions(db_session, reservation_id=reservation.id, user_id=renter.id)

    assert len(transactions) == 1
    assert transactions[0].type == "hold"
    assert transactions[0].amount == 15000


def test_get_transactions_requires_participant(db_session: Session, make_user, make_item) -> None:
    """Failure path: a stranger can't view the transaction history, 403 FORBIDDEN."""
    from app.services.reservations import create_reservation, get_transactions

    owner = make_user(email="transactions-owner2@example.com")
    renter = make_user(email="transactions-renter2@example.com")
    stranger = make_user(email="transactions-stranger2@example.com")
    item = make_item(owner_id=owner.id)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 3)
    )

    with pytest.raises(AppError) as exc_info:
        get_transactions(db_session, reservation_id=reservation.id, user_id=stranger.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def _make_closed_reservation(db_session: Session, owner, renter, item, start_offset: int):
    from app.services.reservations import (
        approve_reservation,
        checkin_reservation,
        checkout_reservation,
        close_reservation,
        create_reservation,
    )

    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(start_offset, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)
    checkin_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/in.jpg"),
    )
    checkout_reservation(
        db_session,
        reservation_id=reservation.id,
        renter_id=renter.id,
        data=CheckInOutRequest(photo_url="https://example.com/out.jpg"),
    )
    return close_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)


def test_get_earnings_happy_path(db_session: Session, make_user, make_item) -> None:
    """Happy path: total_earnings and by_item reflect a closed, released reservation."""
    from app.services.reservations import get_earnings

    owner = make_user(email="earnings-owner1@example.com")
    renter = make_user(email="earnings-renter1@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000, name="Taladro Bosch")
    _make_closed_reservation(db_session, owner, renter, item, start_offset=5)

    earnings = get_earnings(db_session, owner_id=owner.id)

    assert earnings.total_earnings == 10000
    assert len(earnings.by_item) == 1
    assert earnings.by_item[0].item_name == "Taladro Bosch"
    assert earnings.by_item[0].total == 10000
    assert len(earnings.by_item[0].rentals) == 1


def test_get_earnings_only_counts_closed_reservations(
    db_session: Session, make_user, make_item
) -> None:
    """Edge path: an approved-but-not-closed reservation doesn't count
    toward earnings.
    """
    from app.services.reservations import approve_reservation, create_reservation, get_earnings

    owner = make_user(email="earnings-owner2@example.com")
    renter = make_user(email="earnings-renter2@example.com")
    item = make_item(owner_id=owner.id, price_per_day=5000)
    reservation = create_reservation(
        db_session, item_id=item.id, renter_id=renter.id, data=_dates(5, 2)
    )
    approve_reservation(db_session, reservation_id=reservation.id, owner_id=owner.id)

    earnings = get_earnings(db_session, owner_id=owner.id)

    assert earnings.total_earnings == 0
    assert earnings.by_item == []


def test_get_earnings_only_counts_this_owners_items(db_session: Session, make_user, make_item) -> None:
    """Edge path: a different owner's closed reservation isn't counted —
    cross-tenant isolation.
    """
    from app.services.reservations import get_earnings

    owner_a = make_user(email="earnings-ownerA@example.com")
    owner_b = make_user(email="earnings-ownerB@example.com")
    renter = make_user(email="earnings-renter3@example.com")
    item_a = make_item(owner_id=owner_a.id, price_per_day=5000)
    _make_closed_reservation(db_session, owner_a, renter, item_a, start_offset=5)

    earnings_b = get_earnings(db_session, owner_id=owner_b.id)

    assert earnings_b.total_earnings == 0
    assert earnings_b.by_item == []
```

Add to the top imports of `apps/api/tests/services/test_reservations.py` (if not already present from Task 4):
```python
from app.schemas.check_evidence import CheckInOutRequest
```

Append to `apps/api/tests/routers/test_reservations.py`:

```python
def test_transactions_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: after approving, the transactions endpoint returns one
    hold entry.
    """
    owner_token = _register_and_login(client, "resrouter-owner-tx1@example.com")
    item_id = _create_item(client, owner_token, price_per_day=5000)
    renter_token = _register_and_login(client, "resrouter-renter-tx1@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=50)),
            "end_date": str(date.today() + timedelta(days=52)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    response = client.get(
        f"/reservations/{reservation_id}/transactions",
        headers={"Authorization": f"Bearer {renter_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["type"] == "hold"


def test_transactions_endpoint_forbidden_for_stranger(client: TestClient) -> None:
    """Failure path: a user who is neither party gets 403 FORBIDDEN."""
    owner_token = _register_and_login(client, "resrouter-owner-tx2@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "resrouter-renter-tx2@example.com")
    stranger_token = _register_and_login(client, "resrouter-stranger-tx2@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=53)),
            "end_date": str(date.today() + timedelta(days=54)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.get(
        f"/reservations/{reservation_id}/transactions",
        headers={"Authorization": f"Bearer {stranger_token}"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_earnings_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: earnings reflects a fully closed reservation."""
    owner_token = _register_and_login(client, "resrouter-owner-earn1@example.com")
    item_id = _create_item(client, owner_token, price_per_day=5000)
    renter_token = _register_and_login(client, "resrouter-renter-earn1@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=55)),
            "end_date": str(date.today() + timedelta(days=56)),
        },
    )
    reservation_id = create_response.json()["id"]
    client.patch(
        f"/reservations/{reservation_id}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkin",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkin.jpg"},
    )
    client.post(
        f"/reservations/{reservation_id}/checkout",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"photo_url": "https://example.com/checkout.jpg"},
    )
    client.patch(
        f"/reservations/{reservation_id}/close",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    response = client.get(
        "/users/me/earnings",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_earnings"] == 10000
    assert len(body["by_item"]) == 1


def test_earnings_endpoint_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.get("/users/me/earnings")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
```

`_create_item` already accepts a `price_per_day` parameter (see its existing definition at the top of `tests/routers/test_reservations.py`) — no change needed there.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py tests/routers/test_reservations.py -k "transactions or earnings" -v`
Expected: FAIL with `ImportError: cannot import name 'get_transactions'` (services) and `404` (router)

- [ ] **Step 3: Implement get_transactions and get_earnings**

In `apps/api/app/services/reservations.py`, add to the imports at the top:
```python
from app.schemas.earnings import EarningsByItem, EarningsResponse, EarningsRental
```

Add these two functions:

```python
def get_transactions(
    db: Session, reservation_id: uuid.UUID, user_id: uuid.UUID
) -> list[Transaction]:
    """Get a reservation's full deposit transaction history.

    Args:
        db: Database session.
        reservation_id: The reservation whose history is requested.
        user_id: The authenticated caller's id — must be its renter or
            the item's owner.

    Returns:
        The reservation's transactions, oldest first.

    Raises:
        AppError: 404 NOT_FOUND if the reservation doesn't exist. 403
            FORBIDDEN if the caller is neither party.
    """
    reservation = _get_reservation_or_404(db, reservation_id)
    _assert_participant(reservation, user_id)
    return reservation.transactions


def get_earnings(db: Session, owner_id: uuid.UUID) -> EarningsResponse:
    """Summarize an owner's earnings from closed, paid-out reservations.

    Args:
        db: Database session.
        owner_id: The authenticated caller's id.

    Returns:
        Total earnings and a per-item breakdown with each rental's date
        range and amount. Renter names are never included.
    """
    reservations = db.scalars(
        select(Reservation)
        .options(joinedload(Reservation.item), selectinload(Reservation.transactions))
        .where(
            Reservation.item_id.in_(select(Item.id).where(Item.owner_id == owner_id)),
            Reservation.status == "closed",
        )
    ).unique()

    by_item: dict[uuid.UUID, EarningsByItem] = {}
    total_earnings = 0
    for reservation in reservations:
        if reservation.deposit_status != "released":
            continue
        total_earnings += reservation.deposit_amount
        item_id = reservation.item_id
        if item_id not in by_item:
            by_item[item_id] = EarningsByItem(
                item_id=item_id, item_name=reservation.item_name, total=0, rentals=[]
            )
        by_item[item_id].total += reservation.deposit_amount
        by_item[item_id].rentals.append(
            EarningsRental(
                start_date=reservation.start_date,
                end_date=reservation.end_date,
                amount=reservation.deposit_amount,
            )
        )

    return EarningsResponse(total_earnings=total_earnings, by_item=list(by_item.values()))
```

In `apps/api/app/routers/reservations.py`, add to the imports:
```python
from app.schemas.earnings import EarningsResponse
from app.schemas.transaction import TransactionResponse
```
and replace the `from app.services.reservations import (...)` block with:

```python
from app.services.reservations import (
    approve_reservation,
    cancel_reservation,
    checkin_reservation,
    checkout_reservation,
    close_reservation,
    create_reservation,
    get_earnings,
    get_transactions,
    list_my_requests,
    list_my_reservations,
    reject_reservation,
)
```

Add these two endpoints:

```python
@router.get("/reservations/{reservation_id}/transactions")
def get_transactions_endpoint(
    reservation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TransactionResponse]:
    """Get a reservation's deposit transaction history.

    Args:
        reservation_id: The reservation whose history is requested.
        current_user: Resolved by get_current_user — must be its renter
            or the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The reservation's transactions, oldest first.
    """
    transactions = get_transactions(db, reservation_id=reservation_id, user_id=current_user.id)
    return [TransactionResponse.model_validate(t) for t in transactions]


@router.get("/users/me/earnings")
def get_earnings_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EarningsResponse:
    """Get the authenticated owner's earnings summary.

    Args:
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        Total earnings and a per-item breakdown.
    """
    return get_earnings(db, owner_id=current_user.id)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest tests/services/test_reservations.py tests/routers/test_reservations.py -v`
Expected: PASS, full files green

- [ ] **Step 5: Run the full test suite**

Run: `cd apps/api && .venv/Scripts/python.exe -m pytest -v`
Expected: All tests pass (144 from before this plan + new tests from Tasks 1-7, no regressions)

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/services/reservations.py apps/api/app/routers/reservations.py apps/api/tests/services/test_reservations.py apps/api/tests/routers/test_reservations.py
git commit -m "feat(api): add transaction history and earnings endpoints"
```

---

## After the plan: manual live verification (not automated)

Per this repo's established convention (PR #16's S3 work, PR #28's double-booking check), once all 7 tasks pass:

1. With Postgres running (`docker compose -f infra/docker-compose.yml up -d db` or the existing `api-db-1` container) and `alembic upgrade head` applied, start `uvicorn app.main:app --reload` from `apps/api/`.
2. Walk the full happy path live: register two users, publish an item, request → approve → check-in → check-out → close a reservation, confirm `GET .../transactions` shows `hold` then `release`, confirm `GET /users/me/earnings` reflects it.
3. Walk the report path live: repeat through check-in, then file a report, confirm `GET .../transactions` shows the `freeze` entry, confirm `PATCH .../close` is rejected with `409 FREEZE_ACTIVE`.
4. Clean up any rows created against the shared dev Postgres before the automated suite runs again (see `apps/api/ROADMAP.md`'s Decisions log, 2026-07-17 entry, for why this matters).
5. Log the result in `apps/api/ROADMAP.md`'s Decisions log and Session log — do not commit that update without showing the diff first (session ritual in `apps/api/CLAUDE.md`).
