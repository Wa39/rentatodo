"""Tests for get_current_user."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import AppError
from app.services.auth import create_access_token


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_get_current_user_returns_user_for_valid_token(db_session: Session, make_user) -> None:
    """Happy path: a valid token for an existing user resolves to that user."""
    from app.dependencies.auth import get_current_user

    user = make_user(email="valid@example.com")
    token = create_access_token(user.id)

    resolved = get_current_user(credentials=_bearer(token), db=db_session)

    assert resolved.id == user.id


def test_get_current_user_raises_unauthorized_when_credentials_missing(db_session: Session) -> None:
    """Failure path: no Authorization header at all -> 401 UNAUTHORIZED."""
    from app.dependencies.auth import get_current_user

    with pytest.raises(AppError) as exc_info:
        get_current_user(credentials=None, db=db_session)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "UNAUTHORIZED"


def test_get_current_user_raises_token_expired_for_expired_token(db_session: Session) -> None:
    """Failure path: a well-formed but expired token -> 401 TOKEN_EXPIRED,
    distinct from a generically invalid token.
    """
    from app.dependencies.auth import get_current_user

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    expired_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "iat": past - timedelta(hours=1), "exp": past},
        settings.jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(AppError) as exc_info:
        get_current_user(credentials=_bearer(expired_token), db=db_session)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "TOKEN_EXPIRED"
