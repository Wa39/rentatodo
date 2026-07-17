"""S3 client for item photo uploads.

Points at real AWS by default. Set ``AWS_ENDPOINT_URL`` (see
``.env.example``) to redirect the client at MiniStack for local
development instead.
"""

import boto3

from app.config import settings

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_s3_region,
    endpoint_url=settings.resolved_aws_endpoint_url,
)
