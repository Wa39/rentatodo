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


def test_report_endpoint_returns_404_for_unknown_reservation(client: TestClient) -> None:
    """Failure path: no reservation exists with that id, 404 NOT_FOUND."""
    token = _register_and_login(client, "reportsrouter-solo1@example.com")

    response = client.post(
        "/reservations/00000000-0000-0000-0000-000000000000/report",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "x", "photo_url": "https://example.com/x.jpg"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_report_endpoint_returns_403_for_non_participant(client: TestClient) -> None:
    """Failure path: a user who is neither the renter nor the item's
    owner can't report, 403 FORBIDDEN.
    """
    owner_token = _register_and_login(client, "reportsrouter-owner2@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter2@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=42)),
            "end_date": str(date.today() + timedelta(days=43)),
        },
    )
    reservation_id = create_response.json()["id"]
    stranger_token = _register_and_login(client, "reportsrouter-stranger1@example.com")

    response = client.post(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {stranger_token}"},
        json={"reason": "x", "photo_url": "https://example.com/x.jpg"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_report_endpoint_returns_409_for_invalid_transition(client: TestClient) -> None:
    """Failure path: a reservation that's neither delivered nor returned
    (still just "requested" here) can't be reported, 409
    INVALID_TRANSITION.
    """
    owner_token = _register_and_login(client, "reportsrouter-owner3@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter3@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=44)),
            "end_date": str(date.today() + timedelta(days=45)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.post(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"reason": "x", "photo_url": "https://example.com/x.jpg"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_TRANSITION"


def test_report_endpoint_returns_409_when_a_report_already_exists(client: TestClient) -> None:
    """Failure path: a reservation can only be reported once, 409
    REPORT_EXISTS on the second attempt. This is also the router-level
    coverage of the freeze path — the only path that blocks
    close_reservation, previously untested at the router level.
    """
    owner_token = _register_and_login(client, "reportsrouter-owner4@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter4@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=46)),
            "end_date": str(date.today() + timedelta(days=47)),
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
    first = client.post(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"reason": "Item arrived damaged", "photo_url": "https://example.com/damaged.jpg"},
    )
    assert first.status_code == 201

    second = client.post(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"reason": "Still damaged", "photo_url": "https://example.com/damaged2.jpg"},
    )

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "REPORT_EXISTS"


def test_get_report_endpoint_happy_path(client: TestClient) -> None:
    """Happy path: fetch a previously-filed report back."""
    owner_token = _register_and_login(client, "reportsrouter-owner5@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter5@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=48)),
            "end_date": str(date.today() + timedelta(days=49)),
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
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"reason": "Item arrived damaged", "photo_url": "https://example.com/damaged.jpg"},
    )

    response = client.get(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 200
    assert response.json()["reason"] == "Item arrived damaged"


def test_get_report_endpoint_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.get(
        "/reservations/00000000-0000-0000-0000-000000000000/report",
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_get_report_endpoint_returns_404_for_unknown_reservation(client: TestClient) -> None:
    """Failure path: no reservation exists with that id, 404 NOT_FOUND."""
    token = _register_and_login(client, "reportsrouter-solo2@example.com")

    response = client.get(
        "/reservations/00000000-0000-0000-0000-000000000000/report",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_get_report_endpoint_returns_403_for_non_participant(client: TestClient) -> None:
    """Failure path: a stranger can't read the report, 403 FORBIDDEN."""
    owner_token = _register_and_login(client, "reportsrouter-owner6@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter6@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=50)),
            "end_date": str(date.today() + timedelta(days=51)),
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
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={"reason": "x", "photo_url": "https://example.com/x.jpg"},
    )
    stranger_token = _register_and_login(client, "reportsrouter-stranger2@example.com")

    response = client.get(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {stranger_token}"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_get_report_endpoint_returns_404_when_none_filed(client: TestClient) -> None:
    """Failure path: a reservation with no report yet is 404 NOT_FOUND."""
    owner_token = _register_and_login(client, "reportsrouter-owner7@example.com")
    item_id = _create_item(client, owner_token)
    renter_token = _register_and_login(client, "reportsrouter-renter7@example.com")
    create_response = client.post(
        f"/items/{item_id}/reservations",
        headers={"Authorization": f"Bearer {renter_token}"},
        json={
            "start_date": str(date.today() + timedelta(days=52)),
            "end_date": str(date.today() + timedelta(days=53)),
        },
    )
    reservation_id = create_response.json()["id"]

    response = client.get(
        f"/reservations/{reservation_id}/report",
        headers={"Authorization": f"Bearer {renter_token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
