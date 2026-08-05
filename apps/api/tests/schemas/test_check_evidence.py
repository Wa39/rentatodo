"""Tests for the CheckInOutRequest schema."""

import pytest
from pydantic import ValidationError

from app.schemas.check_evidence import CheckInOutRequest


def test_check_in_out_request_accepts_photo_url_only() -> None:
    """Happy path: notes is optional, defaults to None."""
    request = CheckInOutRequest(photo_url="https://example.com/photo.jpg")

    assert request.photo_url == "https://example.com/photo.jpg"
    assert request.notes is None


def test_check_in_out_request_accepts_notes() -> None:
    """Happy path: notes is stored as given when provided."""
    request = CheckInOutRequest(
        photo_url="https://example.com/photo.jpg",
        notes="Received with case and 3 drill bits",
    )

    assert request.notes == "Received with case and 3 drill bits"


def test_check_in_out_request_requires_photo_url() -> None:
    """Failure path: photo_url is required."""
    with pytest.raises(ValidationError):
        CheckInOutRequest(notes="No photo attached")
