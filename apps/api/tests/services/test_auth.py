"""Tests for password hashing and JWT primitives in app.services.auth."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import AppError
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth import (
    authenticate_user,
    create_access_token,
    decode_access_token,
    hash_password,
    register_user,
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


def test_register_user_creates_a_user_with_hashed_password(db_session: Session) -> None:
    """Happy path: registering returns a User whose password isn't
    stored in plaintext.
    """
    data = RegisterRequest(name="Maria", email="maria3@example.com", password="securepass123")

    user = register_user(db_session, data)

    assert user.email == "maria3@example.com"
    assert user.password_hash != "securepass123"
    assert verify_password("securepass123", user.password_hash)


def test_register_user_rejects_duplicate_email(db_session: Session, make_user) -> None:
    """Failure path: registering with an email already in use raises
    422 VALIDATION_ERROR.
    """
    make_user(email="taken@example.com")
    data = RegisterRequest(name="Someone Else", email="taken@example.com", password="securepass123")

    with pytest.raises(AppError) as exc_info:
        register_user(db_session, data)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "VALIDATION_ERROR"


def test_authenticate_user_returns_user_and_token_for_correct_credentials(
    db_session: Session, make_user
) -> None:
    """Happy path: correct email+password returns the user and a token
    that decodes back to that user's id.
    """
    user = make_user(email="login@example.com", password="correctpass1")
    data = LoginRequest(email="login@example.com", password="correctpass1")

    authenticated_user, token = authenticate_user(db_session, data)

    assert authenticated_user.id == user.id
    assert decode_access_token(token) == user.id


def test_authenticate_user_rejects_wrong_password(db_session: Session, make_user) -> None:
    """Failure path: wrong password raises 401 UNAUTHORIZED."""
    make_user(email="login2@example.com", password="correctpass1")
    data = LoginRequest(email="login2@example.com", password="wrongpassword")

    with pytest.raises(AppError) as exc_info:
        authenticate_user(db_session, data)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "UNAUTHORIZED"
