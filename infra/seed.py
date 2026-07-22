"""Seed the development database with test users, items, and reservations.

Run from the repo root with the API virtual-env active:

    DATABASE_URL=postgresql+psycopg://rentatodo:rentatodo@localhost:5432/rentatodo \
    JWT_SECRET=dev-secret \
    python infra/seed.py

To also seed real photos into MiniStack (requires MiniStack running via
infra/docker-compose.yml and the bucket created):

    DATABASE_URL=postgresql+psycopg://rentatodo:rentatodo@localhost:5432/rentatodo \
    JWT_SECRET=dev-secret \
    AWS_ACCESS_KEY_ID=ministack \
    AWS_SECRET_ACCESS_KEY=ministack \
    AWS_S3_BUCKET=rentatodo-items-wa \
    AWS_ENDPOINT_URL=http://localhost:4566 \
    python infra/seed.py

Without S3 env vars, photo_url falls back to a public placeholder image.
When S3 env vars are present, a small solid-color PNG (one per category) is
uploaded directly via boto3 and the resulting public URL is stored instead.

Test credentials (both users share the same password):
    owner@rentatodo.dev  / Rentatodo2026!
    renter@rentatodo.dev / Rentatodo2026!

Items are seeded under owner@rentatodo.dev — one per CategoryEnum value.
Reservations cover every ReservationStatusEnum state (one per item).
"""

import struct
import sys
import uuid
import zlib
from datetime import date, timedelta

sys.path.insert(0, "apps/api")

import bcrypt  # noqa: E402
import boto3  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import engine  # noqa: E402
from app.models.item import Item  # noqa: E402
from app.models.reservation import Reservation, Transaction  # noqa: E402
from app.models.user import User  # noqa: E402

_PASSWORD = "Rentatodo2026!"
_PLACEHOLDER_PHOTO = "https://placehold.co/800x600/png"

# Solid-color (64×64) PNG per category — generated at runtime, no Pillow needed.
_CATEGORY_COLORS: dict[str, tuple[int, int, int]] = {
    "tools":       (210, 140,  60),
    "photography": ( 60,  60,  60),
    "camping":     ( 60, 160,  80),
    "sports":      ( 60, 100, 210),
    "electronics": (140,  60, 210),
    "home":        ( 60, 180, 180),
    "other":       (150, 150, 150),
}

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


def _make_png(r: int, g: int, b: int, size: int = 64) -> bytes:
    """Return raw bytes for a solid-color RGB PNG of the given size.

    Uses only stdlib (struct + zlib) — no Pillow required.

    Args:
        r, g, b: RGB components of the fill color (0–255 each).
        size: Width and height in pixels (square).

    Returns:
        A valid PNG file as a bytes object.
    """
    # One scanline: filter byte (0 = None) followed by RGB triples.
    scanline = bytes([0]) + bytes([r, g, b] * size)
    raw = scanline * size
    idat_data = zlib.compress(raw)

    def _chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB, no alpha
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", idat_data)
        + _chunk(b"IEND", b"")
    )


def _build_s3_client():
    """Return a boto3 S3 client using settings, or None if S3 is not configured."""
    if not (settings.aws_s3_bucket and settings.aws_access_key_id):
        return None
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_s3_region,
        endpoint_url=settings.resolved_aws_endpoint_url,
    )


def _ensure_bucket(s3, bucket: str) -> None:
    """Create the bucket if it doesn't already exist (MiniStack only).

    Args:
        s3: A boto3 S3 client.
        bucket: Bucket name to create.
    """
    try:
        s3.create_bucket(Bucket=bucket)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            raise


def _upload_photo(s3, bucket: str, category: str, endpoint_url: str | None) -> str:
    """Upload a solid-color PNG to S3/MiniStack and return its public URL.

    The PNG color is chosen per category so items look distinct in the UI.
    The S3 key follows the same pattern as the API's generate_presign service:
    uploads/{uuid}.png — no user_id prefix needed in seed data.

    Args:
        s3: A boto3 S3 client.
        bucket: Target bucket name.
        category: Item category — determines the PNG fill color.
        endpoint_url: The resolved endpoint URL (None = real AWS).

    Returns:
        The permanent public URL of the uploaded object.
    """
    color = _CATEGORY_COLORS.get(category, (150, 150, 150))
    png_bytes = _make_png(*color)
    key = f"uploads/seed/{uuid.uuid4()}.png"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=png_bytes,
        ContentType="image/png",
    )

    if endpoint_url:
        return f"{endpoint_url}/{bucket}/{key}"
    return f"https://{bucket}.s3.{settings.aws_s3_region}.amazonaws.com/{key}"


def seed() -> None:
    today = date.today()

    s3 = _build_s3_client()
    if s3:
        _ensure_bucket(s3, settings.aws_s3_bucket)
        print(f"S3 configured — photos will be uploaded to '{settings.aws_s3_bucket}'.")
    else:
        print("S3 not configured — photo_url will use a public placeholder.")

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
            items = []
            for i in new_items:
                if s3:
                    photo_url = _upload_photo(
                        s3,
                        settings.aws_s3_bucket,
                        i["category"],
                        settings.resolved_aws_endpoint_url,
                    )
                else:
                    photo_url = _PLACEHOLDER_PHOTO

                items.append(Item(
                    owner_id=owner.id,
                    name=i["name"],
                    description=i["description"],
                    category=i["category"],
                    price_per_day=i["price_per_day"],
                    photo_url=photo_url,
                ))

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
