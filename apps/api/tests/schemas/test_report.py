"""Tests for the Report Pydantic schemas."""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.report import CreateReportRequest, ReportResponse


def test_create_report_request_happy_path() -> None:
    """Happy path: reason and photo_url are both required and stored as given."""
    request = CreateReportRequest(
        reason="The drill bit was broken when I received it",
        photo_url="https://example.com/broken.jpg",
    )

    assert request.reason == "The drill bit was broken when I received it"
    assert request.photo_url == "https://example.com/broken.jpg"


def test_create_report_request_rejects_empty_reason() -> None:
    """Failure path: reason must be at least 1 character."""
    with pytest.raises(ValidationError):
        CreateReportRequest(reason="", photo_url="https://example.com/broken.jpg")


def test_report_response_round_trip() -> None:
    """Happy path: ReportResponse holds every field as given."""
    response = ReportResponse(
        id=uuid4(),
        reservation_id=uuid4(),
        reported_by=uuid4(),
        reason="Broken item",
        photo_url="https://example.com/broken.jpg",
        created_at=datetime.now(),
    )

    assert response.reason == "Broken item"
