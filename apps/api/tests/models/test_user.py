"""Tests for the User model and its database-level constraints."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User


def test_user_gets_id_and_created_at_from_postgres(db_session: Session) -> None:
    """Happy path: a User inserted without setting id/created_at still
    gets both, because Postgres fills them in via server defaults.
    """
    user = User(name="Maria Vargas", email="maria@example.com", password_hash="hashed")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.created_at is not None


def test_duplicate_email_is_rejected_by_the_database(db_session: Session) -> None:
    """Failure path: the unique constraint on email is enforced by
    Postgres itself, not only by application code.
    """
    db_session.add(User(name="Maria", email="dup@example.com", password_hash="hashed"))
    db_session.commit()

    db_session.add(User(name="Other Maria", email="dup@example.com", password_hash="hashed"))
    with pytest.raises(IntegrityError):
        db_session.commit()
