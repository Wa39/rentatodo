"""Integration tests for the Auth endpoints."""

from fastapi.testclient import TestClient


def test_register_returns_201_and_never_includes_the_password(client: TestClient) -> None:
    """Happy path: registering returns 201 and a profile with no password
    field of any kind.
    """
    response = client.post(
        "/auth/register",
        json={"name": "Maria Vargas", "email": "maria@example.com", "password": "securepass123"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "maria@example.com"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_rejects_duplicate_email(client: TestClient, make_user) -> None:
    """Failure path: registering with an email already in use returns
    422 VALIDATION_ERROR in the contract's structured error shape.
    """
    make_user(email="duplicate@example.com")

    response = client.post(
        "/auth/register",
        json={"name": "Someone Else", "email": "duplicate@example.com", "password": "securepass123"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_returns_token_and_expires_in(client: TestClient, make_user) -> None:
    """Happy path: logging in with correct credentials returns a token
    and the documented 24h expiry.
    """
    make_user(email="login@example.com", password="correctpass1")

    response = client.post(
        "/auth/login", json={"email": "login@example.com", "password": "correctpass1"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 86400
    assert body["access_token"]


def test_login_rejects_wrong_password(client: TestClient, make_user) -> None:
    """Failure path: wrong password returns 401 UNAUTHORIZED."""
    make_user(email="login-wrong-password@example.com", password="correctpass1")

    response = client.post(
        "/auth/login", json={"email": "login-wrong-password@example.com", "password": "wrongpassword"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_get_me_returns_profile_for_valid_token(client: TestClient, make_user) -> None:
    """Happy path: GET /users/me with a valid token returns that user's
    profile.
    """
    make_user(email="me@example.com", password="correctpass1")
    login_response = client.post(
        "/auth/login", json={"email": "me@example.com", "password": "correctpass1"}
    )
    token = login_response.json()["access_token"]

    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


def test_get_me_rejects_missing_token(client: TestClient) -> None:
    """Failure path: GET /users/me with no Authorization header returns
    401 UNAUTHORIZED.
    """
    response = client.get("/users/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"
