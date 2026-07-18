"""Seed the development database with test users and items.

Run from the repo root with the API virtual-env active:

    DATABASE_URL=postgresql+psycopg://rentatodo:rentatodo@localhost:5432/rentatodo \
    JWT_SECRET=dev-secret \
    python infra/seed.py

Test credentials (both users use the same password):
    owner@rentatodo.dev  / Rentatodo2026!
    renter@rentatodo.dev / Rentatodo2026!

Items are seeded under owner@rentatodo.dev — one per CategoryEnum value.
photo_url uses a public placeholder image (no S3 required to run the seed).

TODO (add once Trucy merges Reservation model):
    - Seed reservations in every ReservationStatusEnum state
"""

import sys

sys.path.insert(0, "apps/api")

import bcrypt  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import engine  # noqa: E402
from app.models.item import Item  # noqa: E402
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


def seed() -> None:
    with Session(engine) as session:
        # --- Users ---
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

        # Reload all users so we have their IDs regardless of insert path.
        for user in session.query(User).all():
            users_by_email[user.email] = user

        # --- Items ---
        owner = users_by_email.get("owner@rentatodo.dev")
        if owner is None:
            print("ERROR: owner user not found — cannot seed items.")
            return

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
            print(f"Seeded {len(items)} item(s):")
            for i in new_items:
                print(f"  [{i['category']}] {i['name']} — ${i['price_per_day'] / 100:.2f}/día")
        else:
            print("Items already seeded.")

        session.commit()


if __name__ == "__main__":
    seed()
