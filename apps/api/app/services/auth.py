"""Business logic for registration and login: password hashing, JWT
issuance/validation, and (added in Task 8) the register/login flows.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


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
