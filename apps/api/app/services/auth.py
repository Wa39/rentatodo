"""Business logic for registration and login: password hashing, JWT
issuance/validation, and (added in Task 8) the register/login flows.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import AppError
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt.

    Args:
        plain: The plaintext password. Must be 72 bytes or fewer — bcrypt
            silently ignores anything past that limit. Callers should
            reject longer passwords before calling this (see
            ``RegisterRequest.password``'s ``max_length`` in Task 7).

    Returns:
        The bcrypt hash, as a string, suitable for storing in
        ``User.password_hash``.
    """
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plaintext password against a bcrypt hash.

    Args:
        plain: The plaintext password to check.
        hashed: The stored bcrypt hash to check it against.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a signed JWT identifying the given user.

    Args:
        user_id: The id of the user the token authenticates.

    Returns:
        A JWT string, signed with ``settings.jwt_secret``, valid for
        ``settings.jwt_expiration_hours`` hours from now.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expiration_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> uuid.UUID:
    """Decode and validate an access token, returning the user id it names.

    Args:
        token: The JWT string to decode.

    Returns:
        The user id encoded in the token's ``sub`` claim.

    Raises:
        jwt.ExpiredSignatureError: If the token is well-formed but expired.
        jwt.InvalidTokenError: If the token is malformed or has an invalid
            signature.
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    return uuid.UUID(payload["sub"])


def register_user(db: Session, data: RegisterRequest) -> User:
    """Create a new user account.

    Args:
        db: Database session.
        data: The validated registration payload.

    Returns:
        The newly created User.

    Raises:
        AppError: 422 VALIDATION_ERROR if the email is already registered.
    """
    existing = db.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise AppError(422, "VALIDATION_ERROR", "Email is already registered")

    user = User(name=data.name, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(422, "VALIDATION_ERROR", "Email is already registered")
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: LoginRequest) -> tuple[User, str]:
    """Verify credentials and issue an access token.

    Args:
        db: Database session.
        data: The validated login payload.

    Returns:
        A tuple of the authenticated User and a freshly created access
        token.

    Raises:
        AppError: 401 UNAUTHORIZED if the email doesn't exist or the
            password doesn't match. Deliberately doesn't distinguish
            which of the two failed.
    """
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None or not verify_password(data.password, user.password_hash):
        raise AppError(401, "UNAUTHORIZED", "Invalid email or password")

    token = create_access_token(user.id)
    return user, token
