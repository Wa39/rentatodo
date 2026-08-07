"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Attributes:
        database_url: SQLAlchemy connection string for PostgreSQL, read
            from the ``DATABASE_URL`` environment variable (or ``.env``).
        jwt_secret: Secret key used to sign and verify JWTs, read from the
            ``JWT_SECRET`` environment variable (or ``.env``).
        jwt_expiration_hours: How many hours an issued access token stays
            valid, read from ``JWT_EXPIRATION_HOURS`` (or ``.env``).
        cors_origins: Comma-separated list of origins allowed to make
            cross-origin requests, read from ``CORS_ORIGINS`` (or ``.env``).
            Kept as a raw string (not a list) so a plain comma-separated
            value in ``.env`` works without pydantic-settings' JSON parsing.
        aws_access_key_id: IAM credential for the S3 client, read from
            ``AWS_ACCESS_KEY_ID`` (or ``.env``). Any non-empty string works
            against MiniStack, which doesn't validate credentials.
        aws_secret_access_key: IAM credential for the S3 client, read from
            ``AWS_SECRET_ACCESS_KEY`` (or ``.env``).
        aws_s3_bucket: Name of the bucket item photos are uploaded to, read
            from ``AWS_S3_BUCKET`` (or ``.env``).
        aws_s3_region: AWS region the bucket lives in, read from
            ``AWS_S3_REGION`` (or ``.env``).
        aws_endpoint_url: Overrides the S3 endpoint boto3 talks to, read
            from ``AWS_ENDPOINT_URL`` (or ``.env``). Empty by default (real
            AWS); set to MiniStack's URL for local development only.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expiration_hours: int = 24
    cors_origins: str = "http://localhost:8081"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = ""
    aws_s3_region: str = "us-east-1"
    aws_endpoint_url: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        """``cors_origins`` split into individual origin strings."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def resolved_aws_endpoint_url(self) -> str | None:
        """``aws_endpoint_url`` as boto3 expects it: ``None`` targets real
        AWS, a URL redirects the S3 client to MiniStack for local dev.
        """
        return self.aws_endpoint_url or None


settings = Settings()
