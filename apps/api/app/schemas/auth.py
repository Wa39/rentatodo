"""Pydantic schemas for the Auth endpoints: register, login, and the
current-user profile. Mirrors packages/contracts/openapi.yaml exactly.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    name: str = Field(..., min_length=1, description="Display name.")
    email: EmailStr = Field(..., description="Login identifier. Must be unique.")
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description=(
            "Plaintext password, 8-72 characters. The 72-char ceiling "
            "matches bcrypt's hashing limit."
        ),
    )


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    email: EmailStr = Field(..., description="The account's email.")
    password: str = Field(..., description="The account's plaintext password.")


class LoginResponse(BaseModel):
    """Response for a successful POST /auth/login."""

    access_token: str = Field(
        ..., description='JWT to send as "Authorization: Bearer <token>" on future requests.'
    )
    token_type: str = Field(default="bearer", description='Always "bearer".')
    expires_in: int = Field(..., description="Token lifetime in seconds.")


class UserResponse(BaseModel):
    """Public user profile. Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    created_at: datetime
