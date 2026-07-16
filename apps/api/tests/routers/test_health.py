"""Tests for the GET /health endpoint."""

from collections.abc import Iterator

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import app


def test_health_returns_ok_when_database_is_reachable() -> None:
    """Happy path: the database responds, so /health reports "ok".

    This hits the real database configured via .env (no mocking), the
    same way the /health endpoint itself does.
    """
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_500_when_database_is_unreachable() -> None:
    """Failure path: if the database call fails, /health must not report
    a false "ok" — it should surface a 500 instead.

    Simulated via a dependency override so the test doesn't depend on
    actually breaking the real database connection.
    """

    class _BrokenSession:
        """Fake session whose execute() always raises, standing in for
        an unreachable database.
        """

        def execute(self, *args: object, **kwargs: object) -> None:
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    def broken_get_db() -> Iterator[_BrokenSession]:
        yield _BrokenSession()

    app.dependency_overrides[get_db] = broken_get_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        response = client.get("/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
