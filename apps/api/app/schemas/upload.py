"""Pydantic schemas for the Uploads endpoint: requesting a pre-signed S3
URL. Mirrors packages/contracts/openapi.yaml's /uploads/presign path exactly.
"""

from enum import Enum

from pydantic import BaseModel, Field


class ContentTypeEnum(str, Enum):
    """The contract's closed set of accepted image content types."""

    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"


class PresignRequest(BaseModel):
    """Payload for POST /uploads/presign."""

    filename: str = Field(
        ...,
        min_length=1,
        description="Original filename provided by the client. Not used to derive the S3 key in this implementation — the key is built from the authenticated user's id and a generated identifier instead.",
    )
    content_type: ContentTypeEnum = Field(..., description="MIME type of the file to upload.")


class PresignResponse(BaseModel):
    """Response for POST /uploads/presign.

    upload_url and public_url are plain strings, not AnyUrl — they are
    already-correct output URLs (upload_url carries an AWS signature
    query string) and shouldn't be re-validated/re-normalized.
    """

    upload_url: str = Field(
        ..., description="Short-lived pre-signed S3 PUT URL. PUT the file here directly. The PUT must send the same Content-Type header as this request's content_type, or the signature will not validate."
    )
    public_url: str = Field(
        ..., description="Permanent public URL to store as photo_url after a successful upload."
    )
    expires_in: int = Field(..., description="Seconds until upload_url expires.")
