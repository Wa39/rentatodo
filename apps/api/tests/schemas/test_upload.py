"""Tests for the Uploads Pydantic schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.upload import PresignRequest, PresignResponse


def test_presign_request_accepts_each_valid_content_type() -> None:
    """Happy path: each of the three contract-allowed content types validates."""
    for content_type in ("image/jpeg", "image/png", "image/webp"):
        request = PresignRequest(filename="photo.jpg", content_type=content_type)
        assert request.content_type.value == content_type


def test_presign_request_rejects_invalid_content_type() -> None:
    """Failure path: a content_type outside the contract's enum is rejected."""
    with pytest.raises(ValidationError):
        PresignRequest(filename="photo.gif", content_type="image/gif")


def test_presign_response_holds_plain_string_urls() -> None:
    """PresignResponse keeps upload_url/public_url as plain strings (not
    AnyUrl) so a signed query string (X-Amz-Signature, etc.) round-trips
    unmodified — see Global Constraints.
    """
    response = PresignResponse(
        upload_url="https://rentatodo-items-wa.s3.us-east-1.amazonaws.com/uploads/abc/def.jpg?X-Amz-Signature=xyz",
        public_url="https://rentatodo-items-wa.s3.us-east-1.amazonaws.com/uploads/abc/def.jpg",
        expires_in=300,
    )
    assert response.expires_in == 300
    assert response.upload_url.endswith("X-Amz-Signature=xyz")
