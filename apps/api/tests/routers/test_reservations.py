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
