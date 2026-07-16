"""Smoke test for the client/db_session fixtures themselves — not tied
to any specific feature.
"""

from fastapi.testclient import TestClient


def test_client_fixture_can_reach_the_health_endpoint(client: TestClient) -> None:
    """The client fixture's dependency override doesn't break a request
    that goes through get_db (the /health endpoint queries the DB).
    """
    response = client.get("/health")

    assert response.status_code == 200
