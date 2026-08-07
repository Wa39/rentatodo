"""Pydantic schemas for Transactions. Mirrors
packages/contracts/openapi.yaml's TransactionResponse exactly.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TransactionTypeEnum(str, Enum):
    """The three transaction types in the deposit ledger."""

    HOLD = "hold"
    RELEASE = "release"
    FREEZE = "freeze"


class TransactionResponse(BaseModel):
    """Public transaction representation, as returned by
    GET /reservations/{reservation_id}/transactions.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reservation_id: UUID
    type: TransactionTypeEnum
    amount: int
    created_at: datetime
