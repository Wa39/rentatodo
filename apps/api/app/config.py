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
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expiration_hours: int = 24


settings = Settings()
