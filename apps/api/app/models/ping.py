"""SQLAlchemy model for the `ping` table.

Used only to verify that the database connection, SQLAlchemy models, and
Alembic migrations work end-to-end. Not a business entity.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Ping(Base):
    """A throwaway row used to prove the DB connection and migrations work.

    Attributes:
        id: Primary key.
        message: Arbitrary text payload; no business meaning.
    """

    __tablename__ = "ping"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
