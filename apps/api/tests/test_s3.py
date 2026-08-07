"""Tests for the S3 client factory (app/s3.py)."""

import pytest

from app import s3
from app.config import Settings


def test_build_s3_client_passes_none_for_empty_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY must reach boto3.client
    as None, not "". boto3 treats an empty string as an explicit (invalid)
    credential and skips the IAM-role/credential-chain fallback — this is
    what breaks photo uploads on EC2 in production, where no access key is
    ever set and the instance is meant to authenticate via its IAM role.
    """
    calls: list[dict] = []

    def _fake_client(service_name: str, **kwargs: object) -> object:
        calls.append(kwargs)
        return object()

    monkeypatch.setattr(s3.boto3, "client", _fake_client)
    monkeypatch.setattr(
        s3, "settings", Settings(aws_access_key_id="", aws_secret_access_key="")
    )

    s3._build_s3_client()

    assert calls[0]["aws_access_key_id"] is None
    assert calls[0]["aws_secret_access_key"] is None


def test_build_s3_client_passes_through_real_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When credentials ARE set (e.g. against MiniStack locally), they must
    reach boto3.client unchanged — only the empty-string case should be
    converted to None.
    """
    calls: list[dict] = []

    def _fake_client(service_name: str, **kwargs: object) -> object:
        calls.append(kwargs)
        return object()

    monkeypatch.setattr(s3.boto3, "client", _fake_client)
    monkeypatch.setattr(
        s3,
        "settings",
        Settings(aws_access_key_id="ministack", aws_secret_access_key="ministack-secret"),
    )

    s3._build_s3_client()

    assert calls[0]["aws_access_key_id"] == "ministack"
    assert calls[0]["aws_secret_access_key"] == "ministack-secret"
