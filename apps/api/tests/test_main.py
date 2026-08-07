"""Tests for app-level wiring in main.py: CORS and the RequestValidationError
handler.
"""

import asyncio
import json

from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient

from app.main import app, validation_error_handler


def test_cors_allows_configured_origin_preflight() -> None:
    """Happy path: a preflight OPTIONS from Expo web's dev origin gets the
    Access-Control-Allow-Origin header back, so the browser lets the real
    request through.
    """
    client = TestClient(app)

    response = client.options(
        "/auth/register",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"


def test_cors_rejects_unconfigured_origin_preflight() -> None:
    """Failure path: a preflight from an origin that isn't in CORS_ORIGINS
    gets no Access-Control-Allow-Origin header, so the browser blocks it.
    """
    client = TestClient(app)

    response = client.options(
        "/auth/register",
        headers={
            "Origin": "http://evil.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert "access-control-allow-origin" not in response.headers


def test_validation_error_handler_joins_all_field_errors() -> None:
    """Happy path: several invalid/missing fields at once become one
    contract-shaped error whose message lists every field, not just the
    first — so the client can show all of them without round-tripping.
    """
    errors = [
        {"loc": ("body", "name"), "msg": "Field required", "type": "missing"},
        {
            "loc": ("body", "email"),
            "msg": "value is not a valid email address",
            "type": "value_error",
        },
    ]
    exc = RequestValidationError(errors)

    response = asyncio.run(validation_error_handler(request=None, exc=exc))

    assert response.status_code == 422
    body = json.loads(response.body)
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"] == (
        "name: Field required; email: value is not a valid email address"
    )


def test_validation_error_handler_wired_into_register_endpoint() -> None:
    """Failure path: hitting a real endpoint with an invalid body returns
    the contract's error shape, not FastAPI's default {"detail": [...]}.
    """
    client = TestClient(app)

    response = client.post("/auth/register", json={"email": "not-an-email"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
