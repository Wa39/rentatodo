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
