"""Database connection setup: SQLAlchemy engine, session factory, and the
FastAPI dependency used to inject a session scoped to each request.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models.

    SQLAlchemy uses the models that inherit from this class to build the
    table metadata Alembic reads for autogeneration.
    """


def get_db() -> Generator[Session, None, None]:
    """Yield a database session scoped to a single request.

    Intended for use as a FastAPI dependency via ``Depends(get_db)``.
    Ensures the session is closed after the request finishes, even if an
    exception is raised while handling it.

    Yields:
        An active SQLAlchemy session bound to the application engine.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
