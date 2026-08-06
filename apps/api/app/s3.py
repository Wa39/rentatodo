"""S3 client for item photo uploads.

Points at real AWS by default. Set ``AWS_ENDPOINT_URL`` (see
``.env.example``) to redirect the client at MiniStack for local
development instead.
"""

import boto3

from app.config import settings


def _build_s3_client() -> "boto3.client":
    """Construct the boto3 S3 client from the current settings.

    Empty-string credentials are converted to ``None`` before reaching
    boto3: boto3 treats ``""`` as an explicit (invalid) credential and
    will NOT fall back to the IAM-role/credential-chain lookup, which is
    how the client is meant to authenticate in production (EC2 with an
    attached IAM role, no AWS_ACCESS_KEY_ID configured at all). ``None``
    is what tells boto3 to try the credential chain instead.

    Returns:
        A boto3 S3 client pointed at MiniStack (if AWS_ENDPOINT_URL is
        set) or real AWS.
    """
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        region_name=settings.aws_s3_region,
        endpoint_url=settings.resolved_aws_endpoint_url,
    )


s3_client = _build_s3_client()
