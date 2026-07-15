"""Tests for the Auth Pydantic schemas."""

import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.schemas.auth import RegisterRequest, UserResponse
from app.models.user import User


def test_register_request_rejects_password_over_72_chars() -> None:
    """Failure path: a password over bcrypt's 72-byte limit is rejected
    at the validation layer, not silently truncated deeper in the stack.
    """
    with pytest.raises(ValidationError):
        RegisterRequest(name="Maria", email="maria@example.com", password="a" * 73)


def test_user_response_builds_from_a_user_model_without_the_password_hash(
    db_session: Session,
) -> None:
    """Happy path: UserResponse can be built directly from a persisted User
    ORM instance, and never carries the password hash.

    The User is persisted (not just constructed) because id/created_at are
    Postgres server defaults — they're only populated after an INSERT,
    which matches how the real endpoints use this schema (always on an
    already-committed User).
    """
    user = User(name="Maria", email="maria@example.com", password_hash="secret-hash")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    response = UserResponse.model_validate(user)

    assert response.name == "Maria"
    assert "password_hash" not in response.model_dump()
