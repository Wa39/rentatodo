"""Seed the development database with test users, items, and reservations.

Run from the repo root with the API virtual-env active:

    DATABASE_URL=postgresql+psycopg://rentatodo:rentatodo@localhost:5432/rentatodo \
    JWT_SECRET=dev-secret \
    python infra/seed.py

Test credentials (both users share the same password):
    owner@rentatodo.dev  / Rentatodo2026!
    renter@rentatodo.dev / Rentatodo2026!

Items are seeded under owner@rentatodo.dev — one per CategoryEnum value.
Reservations cover every ReservationStatusEnum state (one per item).
photo_url uses a public placeholder image so no S3 is required.
"""

import sys
from datetime import date, timedelta

sys.path.insert(0, "apps/api")

import bcrypt  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import engine  # noqa: E402
from app.models.item import Item  # noqa: E402
from app.models.reservation import Reservation, Transaction  # noqa: E402
from app.models.user import User  # noqa: E402

_PASSWORD = "Rentatodo2026!"
_PLACEHOLDER_PHOTO = "https://placehold.co/800x600/png"

TEST_USERS = [
    {"name": "Ana Dueña", "email": "owner@rentatodo.dev"},
    {"name": "Bob Arrendatario", "email": "renter@rentatodo.dev"},
]

# One item per CategoryEnum value — covers all filter paths in E2E tests.
TEST_ITEMS = [
    {
        "name": "Taladro percutor 18V",
        "description": "Taladro inalámbrico con maletín y 2 baterías. Ideal para trabajos en casa.",
        "category": "tools",
        "price_per_day": 1500,
    },
    {
        "name": "Cámara Sony A7 III",
        "description": "Full-frame mirrorless con lente 28-70mm. Incluye 2 baterías y tarjeta SD.",
        "category": "photography",
        "price_per_day": 8000,
    },
    {
        "name": "Carpa 4 personas Coleman",
        "description": "Carpa resistente al agua para camping. Fácil de armar, incluye bolsa de transporte.",
        "category": "camping",
        "price_per_day": 2500,
    },
    {
        "name": "Bicicleta de montaña Trek",
        "description": "Bicicleta 29\" con suspensión delantera. Talla M. Incluye casco y candado.",
        "category": "sports",
        "price_per_day": 3000,
    },
    {
        "name": "Proyector Epson 3000 lúmenes",
        "description": "Proyector portátil Full HD con HDMI y USB. Perfecto para presentaciones o cine.",
        "category": "electronics",
        "price_per_day": 4500,
    },
    {
        "name": "Aspiradora industrial Karcher",
        "description": "Aspiradora de 30L para polvo y líquidos. Ideal para limpieza profunda.",
        "category": "home",
        "price_per_day": 2000,
    },
    {
        "name": "Karaoke profesional con 2 micrófonos",
        "description": "Sistema de karaoke con pantalla 7\", Bluetooth y 2 micrófonos inalámbricos.",
        "category": "other",
        "price_per_day": 3500,
    },
]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _days(start: date, end: date) -> int:
    """Inclusive day count between two dates."""
    return (end - start).days + 1


def seed() -> None:
    today = date.today()

    with Session(engine) as session:
        # ── Users ──────────────────────────────────────────────────────────
        existing_emails = {u.email for u in session.query(User.email).all()}
        new_users = [u for u in TEST_USERS if u["email"] not in existing_emails]

        users_by_email: dict[str, User] = {}
        if new_users:
            inserted = [
                User(name=u["name"], email=u["email"], password_hash=_hash(_PASSWORD))
                for u in new_users
            ]
            session.add_all(inserted)
            session.flush()
            print(f"Seeded {len(inserted)} user(s):")
            for u in new_users:
                print(f"  {u['email']}  /  {_PASSWORD}")
        else:
            print("Users already seeded.")

        for user in session.query(User).all():
            users_by_email[user.email] = user

        owner = users_by_email.get("owner@rentatodo.dev")
        renter = users_by_email.get("renter@rentatodo.dev")
        if owner is None or renter is None:
            print("ERROR: users not found — cannot seed items or reservations.")
            return

        # ── Items ───────────────────────────────────────────────────────────
        existing_item_names = {i.name for i in session.query(Item.name).all()}
        new_items = [i for i in TEST_ITEMS if i["name"] not in existing_item_names]

        if new_items:
            items = [
                Item(
                    owner_id=owner.id,
                    name=i["name"],
                    description=i["description"],
                    category=i["category"],
                    price_per_day=i["price_per_day"],
                    photo_url=_PLACEHOLDER_PHOTO,
                )
                for i in new_items
            ]
            session.add_all(items)
            session.flush()
            print(f"Seeded {len(items)} item(s):")
            for i in new_items:
                print(f"  [{i['category']}] {i['name']} — ${i['price_per_day'] / 100:.2f}/día")
        else:
            print("Items already seeded.")

        # ── Reservations ────────────────────────────────────────────────────
        if session.query(Reservation).count() > 0:
            print("Reservations already seeded.")
            session.commit()
            return

        items_by_name: dict[str, Item] = {i.name: i for i in session.query(Item).all()}

        # One reservation per status, one per item — no double-booking possible.
        # Dates are relative to today so the seed stays meaningful over time.
        reservations_spec = [
            {
                "item_name": "Taladro percutor 18V",
                "status": "requested",
                "start": today + timedelta(days=7),
                "end": today + timedelta(days=9),
                "transactions": [],
            },
            {
                "item_name": "Cámara Sony A7 III",
                "status": "approved",
                "start": today + timedelta(days=3),
                "end": today + timedelta(days=4),
                "transactions": ["hold"],
            },
            {
                "item_name": "Carpa 4 personas Coleman",
                "status": "delivered",
                "start": today - timedelta(days=1),
                "end": today + timedelta(days=3),
                "transactions": ["hold"],
            },
            {
                "item_name": "Bicicleta de montaña Trek",
                "status": "returned",
                "start": today - timedelta(days=10),
                "end": today - timedelta(days=8),
                "transactions": ["hold"],
            },
            {
                "item_name": "Proyector Epson 3000 lúmenes",
                "status": "closed",
                "start": today - timedelta(days=20),
                "end": today - timedelta(days=19),
                "transactions": ["hold", "release"],
            },
            {
                "item_name": "Aspiradora industrial Karcher",
                "status": "rejected",
                "start": today - timedelta(days=30),
                "end": today - timedelta(days=29),
                "transactions": [],
            },
            {
                "item_name": "Karaoke profesional con 2 micrófonos",
                "status": "cancelled",
                "start": today - timedelta(days=25),
                "end": today - timedelta(days=24),
                "transactions": [],
            },
        ]

        print("Seeding reservations:")
        for spec in reservations_spec:
            item = items_by_name.get(spec["item_name"])
            if item is None:
                print(f"  SKIP {spec['status']} — item '{spec['item_name']}' not found")
                continue

            days = _days(spec["start"], spec["end"])
            deposit = item.price_per_day * days

            reservation = Reservation(
                item_id=item.id,
                renter_id=renter.id,
                start_date=spec["start"],
                end_date=spec["end"],
                status=spec["status"],
                deposit_amount=deposit,
            )
            session.add(reservation)
            session.flush()

            for tx_type in spec["transactions"]:
                session.add(Transaction(
                    reservation_id=reservation.id,
                    type=tx_type,
                    amount=deposit,
                ))

            print(
                f"  [{spec['status']:10}] {spec['item_name']} "
                f"{spec['start']} → {spec['end']} "
                f"(${deposit / 100:.2f}, {days}d)"
            )

        session.commit()


if __name__ == "__main__":
    seed()
