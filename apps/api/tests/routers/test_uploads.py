"""Integration tests for the Uploads endpoint."""

from fastapi.testclient import TestClient

from app.services import uploads


def _register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Uploader", "email": email, "password": "securepass123"},
    )
    login = client.post("/auth/login", json={"email": email, "password": "securepass123"})
    return login.json()["access_token"]


def test_presign_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.post(
        "/uploads/presign",
        json={"filename": "photo.jpg", "content_type": "image/jpeg"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_presign_happy_path(client: TestClient, monkeypatch) -> None:
    """Happy path: an authenticated request gets back upload_url,
    public_url, and expires_in, without ever calling real S3.
    """
    monkeypatch.setattr(
        uploads.s3_client,
        "generate_presigned_url",
        lambda *args, **kwargs: "https://fake-presigned-url.example.com/put",
    )
    token = _register_and_login(client, "uploader@example.com")

    response = client.post(
        "/uploads/presign",
        headers={"Authorization": f"Bearer {token}"},
        json={"filename": "photo.jpg", "content_type": "image/jpeg"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["upload_url"] == "https://fake-presigned-url.example.com/put"
    assert body["public_url"].endswith(".jpg")
    assert body["expires_in"] == uploads.EXPIRES_IN
