"""Tests for Settings, in particular the CORS origins parsing."""

from app.config import Settings


def test_cors_origins_list_splits_comma_separated_value() -> None:
    """Happy path: a comma-separated CORS_ORIGINS env value becomes a list."""
    settings = Settings(cors_origins="http://localhost:8081,http://localhost:5173")

    assert settings.cors_origins_list == [
        "http://localhost:8081",
        "http://localhost:5173",
    ]


def test_cors_origins_list_defaults_to_expo_web() -> None:
    """Failure/default path: with no CORS_ORIGINS set, only Expo web's dev
    origin is allowed — nothing else gets CORS access by accident.
    """
    settings = Settings()

    assert settings.cors_origins_list == ["http://localhost:8081"]


def test_resolved_aws_endpoint_url_defaults_to_real_aws() -> None:
    """Default path: with no AWS_ENDPOINT_URL set, the S3 client should
    target real AWS, not a local override left on by accident.
    """
    settings = Settings()

    assert settings.resolved_aws_endpoint_url is None


def test_resolved_aws_endpoint_url_overrides_for_ministack() -> None:
    """Happy path: a non-empty AWS_ENDPOINT_URL redirects the S3 client to
    MiniStack for local development.
    """
    settings = Settings(aws_endpoint_url="http://localhost:4566")

    assert settings.resolved_aws_endpoint_url == "http://localhost:4566"
