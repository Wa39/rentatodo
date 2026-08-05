"""Pydantic schemas for GET /users/me/earnings. Mirrors
packages/contracts/openapi.yaml's EarningsResponse exactly.
"""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class EarningsRental(BaseModel):
    """One closed-and-paid-out rental of an item, within an
    EarningsByItem entry.
    """

    start_date: date
    end_date: date
    amount: int


class EarningsByItem(BaseModel):
    """One item's earnings breakdown, within an EarningsResponse."""

    item_id: UUID
    item_name: str
    total: int
    rentals: list[EarningsRental]


class EarningsResponse(BaseModel):
    """Owner earnings summary, as returned by GET /users/me/earnings."""

    total_earnings: int
    by_item: list[EarningsByItem]
