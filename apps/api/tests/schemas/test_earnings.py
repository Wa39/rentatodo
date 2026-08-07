"""Tests for the Earnings Pydantic schemas."""

from datetime import date
from uuid import uuid4

from app.schemas.earnings import EarningsByItem, EarningsResponse, EarningsRental


def test_earnings_response_round_trip() -> None:
    """Happy path: a full nested EarningsResponse builds and holds its
    values as given.
    """
    response = EarningsResponse(
        total_earnings=30000,
        by_item=[
            EarningsByItem(
                item_id=uuid4(),
                item_name="Taladro Bosch",
                total=30000,
                rentals=[
                    EarningsRental(
                        start_date=date(2026, 8, 1), end_date=date(2026, 8, 3), amount=15000
                    ),
                    EarningsRental(
                        start_date=date(2026, 8, 10), end_date=date(2026, 8, 12), amount=15000
                    ),
                ],
            )
        ],
    )

    assert response.total_earnings == 30000
    assert len(response.by_item[0].rentals) == 2


def test_earnings_response_empty_by_item() -> None:
    """Edge path: an owner with no closed+released reservations gets an
    empty by_item list and zero total, not an error.
    """
    response = EarningsResponse(total_earnings=0, by_item=[])

    assert response.total_earnings == 0
    assert response.by_item == []
