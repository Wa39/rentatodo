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
