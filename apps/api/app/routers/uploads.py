"""Uploads endpoint: request a pre-signed S3 URL for direct photo uploads."""

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.upload import PresignRequest, PresignResponse
from app.services.uploads import generate_presign

router = APIRouter()


@router.post("/uploads/presign")
def presign_upload(
    data: PresignRequest,
    current_user: User = Depends(get_current_user),
) -> PresignResponse:
    """Get a pre-signed URL to upload a photo directly to S3.

    Args:
        data: The filename (informational only) and content_type of the
            file the client wants to upload.
        current_user: Resolved by get_current_user — the S3 key includes
            this user's id.

    Returns:
        A pre-signed upload_url, the resulting object's permanent
        public_url, and expires_in.
    """
    return generate_presign(user_id=current_user.id, content_type=data.content_type.value)
