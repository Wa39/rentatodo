"""Shared pytest fixtures: an isolated, auto-rolled-back database session
per test, and a TestClient wired to use it.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """A Session bound to a single connection, wrapped in a transaction
    that's rolled back after the test — so nothing a test writes ever
    lands permanently in the database.

    Uses the SAVEPOINT-restart pattern: application code is free to call
    ``session.commit()`` (as ``register_user``/``authenticate_user`` do)
    without ending the outer transaction, because a new SAVEPOINT is
    opened immediately after each commit.
    """
    connection = engine.connect()
    outer_transaction = connection.begin()
    session = Session(bind=connection)
    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess: Session, trans: object) -> None:
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session: Session) -> Iterator[TestClient]:
    """A TestClient whose ``get_db`` dependency is overridden to use the
    test's isolated ``db_session``, so requests made through it run inside
    the same transaction that gets rolled back at teardown.
    """

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
