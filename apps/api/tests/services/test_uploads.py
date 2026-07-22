"""Tests for the Uploads service: generating a pre-signed S3 URL."""

import uuid

import pytest

from app.config import Settings
from app.services import uploads


@pytest.fixture()
def fake_presigned_url(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replaces the real boto3 call with a fixed fake URL and records the
    Params/ExpiresIn it was called with, so tests can assert on them
    without ever talking to S3 or MiniStack.
    """
    calls: list[dict] = []

    def _fake_generate_presigned_url(client_method: str, Params: dict, ExpiresIn: int) -> str:
        calls.append({"client_method": client_method, "Params": Params, "ExpiresIn": ExpiresIn})
        return "https://fake-presigned-url.example.com/put"

    monkeypatch.setattr(uploads.s3_client, "generate_presigned_url", _fake_generate_presigned_url)
    return calls


def test_generate_presign_key_format_and_extension(fake_presigned_url: list) -> None:
    """Happy path: the S3 key is uploads/{user_id}/{uuid}.{ext}, with the
    extension derived from content_type, never from a client filename
    (generate_presign never receives one — see design spec).
    """
    user_id = uuid.uuid4()

    result = uploads.generate_presign(user_id=user_id, content_type="image/png")

    key = fake_presigned_url[0]["Params"]["Key"]
    assert key.startswith(f"uploads/{user_id}/")
    assert key.endswith(".png")
    assert result.expires_in == uploads.EXPIRES_IN


def test_generate_presign_signs_bucket_and_content_type(fake_presigned_url: list) -> None:
    """The presigned URL is requested for the configured bucket, with the
    same content_type the client will send as its PUT's Content-Type
    header — otherwise the signature won't validate on upload.
    """
    uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/jpeg")

    params = fake_presigned_url[0]["Params"]
    assert params["Bucket"] == uploads.settings.aws_s3_bucket
    assert params["ContentType"] == "image/jpeg"


def test_generate_presign_public_url_uses_ministack_endpoint_when_set(
    monkeypatch: pytest.MonkeyPatch, fake_presigned_url: list
) -> None:
    """When AWS_ENDPOINT_URL is set (MiniStack/local dev), public_url
    points at the emulator's endpoint/bucket/key path, not a real AWS domain.
    """
    monkeypatch.setattr(
        uploads,
        "settings",
        Settings(aws_endpoint_url="http://localhost:4566", aws_s3_bucket="rentatodo-items-wa"),
    )

    result = uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/webp")

    assert result.public_url.startswith("http://localhost:4566/rentatodo-items-wa/uploads/")
    assert result.public_url.endswith(".webp")


def test_generate_presign_public_url_uses_virtual_hosted_style_without_endpoint(
    monkeypatch: pytest.MonkeyPatch, fake_presigned_url: list
) -> None:
    """Without AWS_ENDPOINT_URL (real AWS / production), public_url is the
    virtual-hosted-style https://{bucket}.s3.{region}.amazonaws.com/{key}.
    """
    monkeypatch.setattr(
        uploads,
        "settings",
        Settings(
            aws_endpoint_url="", aws_s3_bucket="rentatodo-items-wa", aws_s3_region="us-east-1"
        ),
    )

    result = uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/jpeg")

    assert result.public_url.startswith(
        "https://rentatodo-items-wa.s3.us-east-1.amazonaws.com/uploads/"
    )
    assert result.public_url.endswith(".jpg")


def test_generate_presign_raises_key_error_for_unmapped_content_type(
    fake_presigned_url: list,
) -> None:
    """An unmapped content_type (e.g. image/gif) raises KeyError. This is
    intentional: the router's PresignRequest enum blocks all invalid types
    at the API boundary, so this loud failure signals enum/dict drift during
    maintenance, not a recoverable client error.
    """
    with pytest.raises(KeyError):
        uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/gif")
