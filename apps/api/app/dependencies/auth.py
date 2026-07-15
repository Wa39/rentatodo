"""FastAPI dependency for resolving the authenticated user from a JWT."""

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import AppError
from app.models.user import User
from app.services.auth import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the request's bearer token.

    Args:
        credentials: The parsed ``Authorization: Bearer <token>`` header,
            or None if it was missing/malformed. ``auto_error=False`` on
            the underlying ``HTTPBearer`` is what makes None possible here
            instead of FastAPI raising its own (differently-shaped) 403.
        db: Database session injected by FastAPI.

    Returns:
        The authenticated User.

    Raises:
        AppError: 401 UNAUTHORIZED if the header is missing, the token is
            malformed/has an invalid signature, or the user it names no
            longer exists. 401 TOKEN_EXPIRED if the token is well-formed
            but its expiry has passed.
    """
    if credentials is None:
        raise AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header")

    try:
        user_id = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "Access token has expired")
    except jwt.InvalidTokenError:
        raise AppError(401, "UNAUTHORIZED", "Invalid access token")

    user = db.get(User, user_id)
    if user is None:
        raise AppError(401, "UNAUTHORIZED", "User no longer exists")

    return user
