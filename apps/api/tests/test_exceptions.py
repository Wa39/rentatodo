"""Tests for the AppError -> JSON response translation."""

import asyncio
import json

from app.exceptions import AppError
from app.main import app_error_handler


def test_app_error_handler_returns_the_contract_error_shape() -> None:
    """Happy path: an AppError becomes {"error": {"code", "message"}}
    with the status code the error was raised with.
    """
    error = AppError(status_code=409, code="DATES_UNAVAILABLE", message="Not available")

    response = asyncio.run(app_error_handler(request=None, exc=error))

    assert response.status_code == 409
    assert json.loads(response.body) == {
        "error": {"code": "DATES_UNAVAILABLE", "message": "Not available"}
    }
