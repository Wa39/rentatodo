"""Tests for the Transaction Pydantic schema."""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.transaction import TransactionResponse


def test_transaction_response_accepts_each_valid_type() -> None:
    """Happy path: each of the three ledger types validates."""
    for tx_type in ("hold", "release", "freeze"):
        response = TransactionResponse(
            id=uuid4(),
            reservation_id=uuid4(),
            type=tx_type,
            amount=15000,
            created_at=datetime.now(),
        )
        assert response.type.value == tx_type


def test_transaction_response_rejects_invalid_type() -> None:
    """Failure path: a type outside hold/release/freeze is rejected."""
    with pytest.raises(ValidationError):
        TransactionResponse(
            id=uuid4(),
            reservation_id=uuid4(),
            type="refund",
            amount=15000,
            created_at=datetime.now(),
        )
