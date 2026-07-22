"""Business logic for Uploads: generating a pre-signed S3 URL for direct
client uploads.
"""

import uuid

from app.config import settings
from app.s3 import s3_client
from app.schemas.upload import PresignResponse

EXPIRES_IN = 300
"""Seconds an upload_url stays valid, per the contract ("5 minutes")."""

CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
"""Maps each contract-allowed content_type to a file extension. The
extension always comes from here, never from the client-supplied
filename — avoids path traversal / unsafe characters entirely.
"""


def generate_presign(user_id: uuid.UUID, content_type: str) -> PresignResponse:
    """Generate a pre-signed S3 PUT URL and the resulting object's
    permanent public URL.

    Args:
        user_id: The authenticated user's id, used as part of the S3 key
            so uploads can be traced/cleaned up per user.
        content_type: One of the contract's allowed image MIME types
            (already validated by PresignRequest's enum before this is
            called).

    Returns:
        A PresignResponse with the pre-signed upload_url, the permanent
        public_url, and expires_in.
    """
    extension = CONTENT_TYPE_EXTENSIONS[content_type]
    key = f"uploads/{user_id}/{uuid.uuid4()}.{extension}"

    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.aws_s3_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=EXPIRES_IN,
    )

    if settings.resolved_aws_endpoint_url:
        # MiniStack (local dev): the emulator serves objects at
        # {endpoint}/{bucket}/{key}, not a virtual-hosted-style domain.
        public_url = f"{settings.resolved_aws_endpoint_url}/{settings.aws_s3_bucket}/{key}"
    else:
        # Real AWS: virtual-hosted-style URL.
        public_url = f"https://{settings.aws_s3_bucket}.s3.{settings.aws_s3_region}.amazonaws.com/{key}"

    return PresignResponse(upload_url=upload_url, public_url=public_url, expires_in=EXPIRES_IN)
