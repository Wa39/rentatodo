"""Integration tests for the Items endpoints."""

from fastapi.testclient import TestClient


def test_create_item_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.post(
        "/items",
        json={
            "name": "Taladro",
            "description": "Percutor",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def _register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Owner", "email": email, "password": "securepass123"},
    )
    login = client.post("/auth/login", json={"email": email, "password": "securepass123"})
    return login.json()["access_token"]


def test_create_item_happy_path_owner_id_from_token_not_body(client: TestClient) -> None:
    """Happy path + security check: owner_id in the response is the
    authenticated user's id, even if a caller tries to spoof it in the body.
    """
    token = _register_and_login(client, "owner-create@example.com")

    response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Taladro Bosch",
            "description": "Percutor profesional",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
            "owner_id": "00000000-0000-0000-0000-000000000000",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["owner_id"] != "00000000-0000-0000-0000-000000000000"
    assert body["owner_name"] == "Owner"


def test_create_item_rejects_non_positive_price(client: TestClient) -> None:
    """Failure path: price_per_day <= 0 returns 422 VALIDATION_ERROR."""
    token = _register_and_login(client, "owner-create2@example.com")

    response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Taladro",
            "description": "Percutor",
            "category": "tools",
            "price_per_day": 0,
            "photo_url": "https://example.com/photo.jpg",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_list_items_happy_path_returns_created_item(client: TestClient) -> None:
    """Happy path: an item created via POST /items shows up in GET /items."""
    token = _register_and_login(client, "owner-list@example.com")
    client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Camara Canon",
            "description": "Buen estado",
            "category": "photography",
            "price_per_day": 8000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )

    response = client.get("/items", params={"category": "photography"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert any(item["name"] == "Camara Canon" for item in body["items"])


def test_list_items_returns_empty_when_filter_matches_nothing(client: TestClient) -> None:
    """Failure/edge path: a filter combination matching nothing returns
    an empty list and total=0, not an error.
    """
    response = client.get("/items", params={"min_price": 999999999})

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_get_item_happy_path_returns_detail_with_empty_unavailable_dates(
    client: TestClient,
) -> None:
    """Happy path: item detail includes unavailable_dates as an empty list."""
    token = _register_and_login(client, "owner-detail@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Carpa Camping",
            "description": "4 personas",
            "category": "camping",
            "price_per_day": 3000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.get(f"/items/{item_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Carpa Camping"
    assert body["unavailable_dates"] == []


def test_get_item_returns_404_for_missing_id(client: TestClient) -> None:
    """Failure path: a well-formed but nonexistent id returns 404 NOT_FOUND."""
    response = client.get("/items/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_update_item_happy_path_updates_only_sent_field(client: TestClient) -> None:
    """Happy path: PATCH with only one field changes just that field."""
    token = _register_and_login(client, "patcher1@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Original",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.patch(
        f"/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Actualizado"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Actualizado"
    assert body["price_per_day"] == 5000


def test_update_item_returns_403_for_non_owner(client: TestClient) -> None:
    """Failure path: a different authenticated user cannot edit this item."""
    owner_token = _register_and_login(client, "patcher-owner@example.com")
    other_token = _register_and_login(client, "patcher-other@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Original",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.patch(
        f"/items/{item_id}",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"name": "Hackeado"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_delete_item_happy_path_deactivates(client: TestClient) -> None:
    """Happy path: DELETE sets is_active=False and returns the item."""
    token = _register_and_login(client, "deleter1@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "A borrar",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.delete(f"/items/{item_id}", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_delete_item_returns_404_for_missing_id(client: TestClient) -> None:
    """Failure path: deleting a nonexistent item returns 404 NOT_FOUND."""
    token = _register_and_login(client, "deleter2@example.com")

    response = client.delete(
        "/items/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_list_my_items_requires_authentication(client: TestClient) -> None:
    """Failure path: no token returns 401 UNAUTHORIZED."""
    response = client.get("/users/me/items")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_list_my_items_happy_path_includes_inactive_excludes_others(client: TestClient) -> None:
    """Happy path: my items list includes both an active and a
    soft-deleted item of mine, but not another user's item.
    """
    token = _register_and_login(client, "myitems-router@example.com")
    other_token = _register_and_login(client, "myitems-router-other@example.com")
    client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Activo",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    to_delete_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Para borrar",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    client.delete(
        f"/items/{to_delete_response.json()['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/items",
        headers={"Authorization": f"Bearer {other_token}"},
        json={
            "name": "Ajeno",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )

    response = client.get("/users/me/items", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert names == {"Activo", "Para borrar"}
