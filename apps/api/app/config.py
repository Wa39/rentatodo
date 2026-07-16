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
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expiration_hours: int = 24
    cors_origins: str = "http://localhost:8081"

    @property
    def cors_origins_list(self) -> list[str]:
        """``cors_origins`` split into individual origin strings."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
