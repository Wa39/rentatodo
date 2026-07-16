"""Health check endpoint: confirms the API process is up and can reach
the database.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter()


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    """Check that the API can execute a query against the database.

    Args:
        db: Database session injected by FastAPI via ``get_db``.

    Returns:
        A dict with ``status: "ok"`` when the database responds.

    Raises:
        sqlalchemy.exc.OperationalError: If the database is unreachable.
    """
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
