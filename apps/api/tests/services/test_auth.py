"""Tests for password hashing and JWT primitives in app.services.auth."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.services.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_password_produces_a_hash_verify_password_accepts() -> None:
    """Happy path: hashing then verifying the same password succeeds."""
    hashed = hash_password("correct horse battery staple")

    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_password_rejects_wrong_password() -> None:
    """Failure path: verifying against the wrong password fails."""
    hashed = hash_password("correct horse battery staple")

    assert verify_password("wrong password", hashed) is False


def test_create_and_decode_access_token_round_trips() -> None:
    """Happy path: a token created for a user id decodes back to that id."""
    user_id = uuid.uuid4()
    token = create_access_token(user_id)

    assert decode_access_token(token) == user_id


def test_decode_access_token_raises_on_expired_token() -> None:
    """Failure path: a token whose exp is in the past raises
    ExpiredSignatureError specifically, distinct from a generically
    invalid token — get_current_user (Task 6) relies on this distinction.
    """
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    expired_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "iat": past - timedelta(hours=1), "exp": past},
        settings.jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)
