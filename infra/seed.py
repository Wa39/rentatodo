"""Seed the development database with test users.

Run from the repo root with the API virtual-env active:

    DATABASE_URL=postgresql+psycopg://rentatodo:rentatodo@localhost:5432/rentatodo \
    JWT_SECRET=dev-secret \
    python infra/seed.py

Test credentials (both users use the same password):
    owner@rentatodo.dev  / Rentatodo2026!
    renter@rentatodo.dev / Rentatodo2026!

TODO (add once Trucy merges Item + Reservation models):
    - Seed items with photo_url placeholders across all CategoryEnum values
    - Seed reservations in every ReservationStatusEnum state
"""

import sys

sys.path.insert(0, "apps/api")

import bcrypt  # noqa: E402 — path must be set first
from sqlalchemy.orm import Session  # noqa: E402

from app.database import engine  # noqa: E402
from app.models.user import User  # noqa: E402

_PASSWORD = "Rentatodo2026!"

TEST_USERS = [
    {"name": "Ana Dueña", "email": "owner@rentatodo.dev"},
    {"name": "Bob Arrendatario", "email": "renter@rentatodo.dev"},
]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def seed() -> None:
    with Session(engine) as session:
        existing = {u.email for u in session.query(User.email).all()}
        to_insert = [u for u in TEST_USERS if u["email"] not in existing]

        if not to_insert:
            print("Already seeded — nothing to do.")
            return

        users = [
            User(name=u["name"], email=u["email"], password_hash=_hash(_PASSWORD))
            for u in to_insert
        ]
        session.add_all(users)
        session.commit()

        print(f"Seeded {len(users)} user(s):")
        for u in to_insert:
            print(f"  {u['email']}  /  {_PASSWORD}")


if __name__ == "__main__":
    seed()
