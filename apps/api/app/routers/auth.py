"""Auth endpoints: register, login, and the current-user profile."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, UserResponse
from app.services.auth import authenticate_user, register_user

router = APIRouter()


@router.post("/auth/register", status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> UserResponse:
    """Create a new account.

    Args:
        data: Registration payload (name, email, password).
        db: Database session injected by FastAPI.

    Returns:
        The newly created user's public profile.
    """
    user = register_user(db, data)
    return UserResponse.model_validate(user)


@router.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    """Log in and receive a JWT.

    Args:
        data: Login payload (email, password).
        db: Database session injected by FastAPI.

    Returns:
        An access token, its type, and its lifetime in seconds.
    """
    _, token = authenticate_user(db, data)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.jwt_expiration_hours * 3600,
    )


@router.get("/users/me")
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Get the authenticated user's profile.

    Args:
        current_user: Resolved by the get_current_user dependency.

    Returns:
        The current user's public profile.
    """
    return UserResponse.model_validate(current_user)
