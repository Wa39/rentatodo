# POST /uploads/presign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /uploads/presign` so authenticated clients can get a pre-signed S3 URL to upload a photo directly, plus the permanent public URL to store as `photo_url` afterward.

**Architecture:** Three new files following this repo's established `schemas/` → `services/` → `routers/` layering (see `app/schemas/item.py`, `app/services/items.py`, `app/routers/items.py` for the pattern): `app/schemas/upload.py` (Pydantic request/response mirroring the contract), `app/services/uploads.py` (S3 key generation + `generate_presigned_url` call + public URL construction), `app/routers/uploads.py` (the endpoint, authenticated via the existing `get_current_user` dependency). No database or model changes — this endpoint never touches Postgres.

**Tech Stack:** FastAPI, Pydantic v2, boto3 (via the existing `app/s3.py` client), pytest with `monkeypatch` (no new test dependencies).

## Global Constraints

- Contract is `packages/contracts/openapi.yaml`'s `/uploads/presign` path (`PresignRequest`/`PresignResponse` schemas) — implement to match it exactly, don't invent shapes.
- Every function and class gets a Google-style docstring (what it does, Args, Returns, Raises if applicable) — matches every existing file in `app/`.
- Every non-obvious Pydantic field gets `Field(..., description="...")`.
- Every new router file gets a module-level docstring describing what resource it exposes.
- Type hints everywhere — no implicit typing.
- Every new piece of business logic needs at least one happy-path test and one test for the most likely failure, under `tests/`, mirroring `app/`'s structure.
- All code, comments, and docstrings are in English.
- Response schemas in this codebase use plain `str` for URL fields, not `AnyUrl` (see `ItemResponse.photo_url: str` in `app/schemas/item.py`, vs. `CreateItemRequest.photo_url: AnyUrl`) — `AnyUrl` is for validating *input*, not for round-tripping already-correct output URLs. Pre-signed URLs carry AWS signature query strings (`X-Amz-Signature`, etc.) that don't need re-validation and shouldn't risk mangling — follow this convention for `PresignResponse`.
- The S3 key's file extension always comes from a `content_type → extension` mapping, **never** from the client-supplied `filename` (which is accepted per the contract but otherwise unused) — avoids path traversal / unsafe characters entirely.
- No new pip dependencies — `boto3` (already in `requirements.txt`) and `pytest`'s built-in `monkeypatch` fixture cover everything needed.

---

### Task 1: `PresignRequest`/`PresignResponse` schemas

**Files:**
- Create: `apps/api/app/schemas/upload.py`
- Test: `apps/api/tests/schemas/test_upload.py`

**Interfaces:**
- Consumes: nothing (leaf schemas, no dependency on other tasks).
- Produces: `ContentTypeEnum` (str enum: `JPEG = "image/jpeg"`, `PNG = "image/png"`, `WEBP = "image/webp"`), `PresignRequest(filename: str, content_type: ContentTypeEnum)`, `PresignResponse(upload_url: str, public_url: str, expires_in: int)`. Task 2 and Task 3 import all three from `app.schemas.upload`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/schemas/test_upload.py`:

```python
"""Tests for the Uploads Pydantic schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.upload import PresignRequest, PresignResponse


def test_presign_request_accepts_each_valid_content_type() -> None:
    """Happy path: each of the three contract-allowed content types validates."""
    for content_type in ("image/jpeg", "image/png", "image/webp"):
        request = PresignRequest(filename="photo.jpg", content_type=content_type)
        assert request.content_type.value == content_type


def test_presign_request_rejects_invalid_content_type() -> None:
    """Failure path: a content_type outside the contract's enum is rejected."""
    with pytest.raises(ValidationError):
        PresignRequest(filename="photo.gif", content_type="image/gif")


def test_presign_response_holds_plain_string_urls() -> None:
    """PresignResponse keeps upload_url/public_url as plain strings (not
    AnyUrl) so a signed query string (X-Amz-Signature, etc.) round-trips
    unmodified — see Global Constraints.
    """
    response = PresignResponse(
        upload_url="https://rentatodo-items-wa.s3.us-east-1.amazonaws.com/uploads/abc/def.jpg?X-Amz-Signature=xyz",
        public_url="https://rentatodo-items-wa.s3.us-east-1.amazonaws.com/uploads/abc/def.jpg",
        expires_in=300,
    )
    assert response.expires_in == 300
    assert response.upload_url.endswith("X-Amz-Signature=xyz")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pytest tests/schemas/test_upload.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas.upload'`

- [ ] **Step 3: Write the schemas**

Create `apps/api/app/schemas/upload.py`:

```python
"""Pydantic schemas for the Uploads endpoint: requesting a pre-signed S3
URL. Mirrors packages/contracts/openapi.yaml's /uploads/presign path exactly.
"""

from enum import Enum

from pydantic import BaseModel, Field


class ContentTypeEnum(str, Enum):
    """The contract's closed set of accepted image content types."""

    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"


class PresignRequest(BaseModel):
    """Payload for POST /uploads/presign."""

    filename: str = Field(
        ...,
        min_length=1,
        description="Original filename. Informational only — never used to build the S3 key.",
    )
    content_type: ContentTypeEnum = Field(..., description="MIME type of the file to upload.")


class PresignResponse(BaseModel):
    """Response for POST /uploads/presign.

    upload_url and public_url are plain strings, not AnyUrl — they are
    already-correct output URLs (upload_url carries an AWS signature
    query string) and shouldn't be re-validated/re-normalized.
    """

    upload_url: str = Field(
        ..., description="Short-lived pre-signed S3 PUT URL. PUT the file here directly."
    )
    public_url: str = Field(
        ..., description="Permanent public URL to store as photo_url after a successful upload."
    )
    expires_in: int = Field(..., description="Seconds until upload_url expires.")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pytest tests/schemas/test_upload.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/upload.py apps/api/tests/schemas/test_upload.py
git commit -m "feat(api): add PresignRequest/PresignResponse schemas"
```

---

### Task 2: `generate_presign` service

**Files:**
- Create: `apps/api/app/services/uploads.py`
- Test: `apps/api/tests/services/test_uploads.py`

**Interfaces:**
- Consumes: `PresignResponse` from `app.schemas.upload` (Task 1). `s3_client` from `app.s3` (existing, PR #16). `settings` from `app.config` (existing).
- Produces: `EXPIRES_IN: int` (module-level constant, `300`), `CONTENT_TYPE_EXTENSIONS: dict[str, str]` (module-level constant), `generate_presign(user_id: uuid.UUID, content_type: str) -> PresignResponse`. Task 3 imports `generate_presign` from `app.services.uploads`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/services/test_uploads.py`:

```python
"""Tests for the Uploads service: generating a pre-signed S3 URL."""

import uuid

import pytest

from app.config import Settings
from app.services import uploads


@pytest.fixture()
def fake_presigned_url(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """Replaces the real boto3 call with a fixed fake URL and records the
    Params/ExpiresIn it was called with, so tests can assert on them
    without ever talking to S3 or MiniStack.
    """
    calls: list[dict] = []

    def _fake_generate_presigned_url(client_method: str, Params: dict, ExpiresIn: int) -> str:
        calls.append({"client_method": client_method, "Params": Params, "ExpiresIn": ExpiresIn})
        return "https://fake-presigned-url.example.com/put"

    monkeypatch.setattr(uploads.s3_client, "generate_presigned_url", _fake_generate_presigned_url)
    return calls


def test_generate_presign_key_format_and_extension(fake_presigned_url: list) -> None:
    """Happy path: the S3 key is uploads/{user_id}/{uuid}.{ext}, with the
    extension derived from content_type, never from a client filename
    (generate_presign never receives one — see design spec).
    """
    user_id = uuid.uuid4()

    result = uploads.generate_presign(user_id=user_id, content_type="image/png")

    key = fake_presigned_url[0]["Params"]["Key"]
    assert key.startswith(f"uploads/{user_id}/")
    assert key.endswith(".png")
    assert result.expires_in == uploads.EXPIRES_IN


def test_generate_presign_signs_bucket_and_content_type(fake_presigned_url: list) -> None:
    """The presigned URL is requested for the configured bucket, with the
    same content_type the client will send as its PUT's Content-Type
    header — otherwise the signature won't validate on upload.
    """
    uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/jpeg")

    params = fake_presigned_url[0]["Params"]
    assert params["Bucket"] == uploads.settings.aws_s3_bucket
    assert params["ContentType"] == "image/jpeg"


def test_generate_presign_public_url_uses_ministack_endpoint_when_set(
    monkeypatch: pytest.MonkeyPatch, fake_presigned_url: list
) -> None:
    """When AWS_ENDPOINT_URL is set (MiniStack/local dev), public_url
    points at the emulator's endpoint/bucket/key path, not a real AWS domain.
    """
    monkeypatch.setattr(
        uploads,
        "settings",
        Settings(aws_endpoint_url="http://localhost:4566", aws_s3_bucket="rentatodo-items-wa"),
    )

    result = uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/webp")

    assert result.public_url.startswith("http://localhost:4566/rentatodo-items-wa/uploads/")
    assert result.public_url.endswith(".webp")


def test_generate_presign_public_url_uses_virtual_hosted_style_without_endpoint(
    monkeypatch: pytest.MonkeyPatch, fake_presigned_url: list
) -> None:
    """Without AWS_ENDPOINT_URL (real AWS / production), public_url is the
    virtual-hosted-style https://{bucket}.s3.{region}.amazonaws.com/{key}.
    """
    monkeypatch.setattr(
        uploads,
        "settings",
        Settings(
            aws_endpoint_url="", aws_s3_bucket="rentatodo-items-wa", aws_s3_region="us-east-1"
        ),
    )

    result = uploads.generate_presign(user_id=uuid.uuid4(), content_type="image/jpeg")

    assert result.public_url.startswith(
        "https://rentatodo-items-wa.s3.us-east-1.amazonaws.com/uploads/"
    )
    assert result.public_url.endswith(".jpg")
```

Note: `Settings(...)` picks up `database_url`/`jwt_secret` from the test environment's `.env`/env vars automatically, same as the existing pattern in `apps/api/tests/test_config.py` — no need to pass them explicitly.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pytest tests/services/test_uploads.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.uploads'`

- [ ] **Step 3: Write the service**

Create `apps/api/app/services/uploads.py`:

```python
"""Business logic for Uploads: generating a pre-signed S3 URL for direct
client uploads.
"""

import uuid

from app.config import settings
from app.s3 import s3_client
from app.schemas.upload import PresignResponse

EXPIRES_IN = 300
"""Seconds an upload_url stays valid, per the contract ("5 minutes")."""

CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
"""Maps each contract-allowed content_type to a file extension. The
extension always comes from here, never from the client-supplied
filename — avoids path traversal / unsafe characters entirely.
"""


def generate_presign(user_id: uuid.UUID, content_type: str) -> PresignResponse:
    """Generate a pre-signed S3 PUT URL and the resulting object's
    permanent public URL.

    Args:
        user_id: The authenticated user's id, used as part of the S3 key
            so uploads can be traced/cleaned up per user.
        content_type: One of the contract's allowed image MIME types
            (already validated by PresignRequest's enum before this is
            called).

    Returns:
        A PresignResponse with the pre-signed upload_url, the permanent
        public_url, and expires_in.
    """
    extension = CONTENT_TYPE_EXTENSIONS[content_type]
    key = f"uploads/{user_id}/{uuid.uuid4()}.{extension}"

    upload_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.aws_s3_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=EXPIRES_IN,
    )

    if settings.resolved_aws_endpoint_url:
        # MiniStack (local dev): the emulator serves objects at
        # {endpoint}/{bucket}/{key}, not a virtual-hosted-style domain.
        public_url = f"{settings.resolved_aws_endpoint_url}/{settings.aws_s3_bucket}/{key}"
    else:
        # Real AWS: virtual-hosted-style URL.
        public_url = f"https://{settings.aws_s3_bucket}.s3.{settings.aws_s3_region}.amazonaws.com/{key}"

    return PresignResponse(upload_url=upload_url, public_url=public_url, expires_in=EXPIRES_IN)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pytest tests/services/test_uploads.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/uploads.py apps/api/tests/services/test_uploads.py
git commit -m "feat(api): add generate_presign service"
```

---

### Task 3: `POST /uploads/presign` router + wiring

**Files:**
- Create: `apps/api/app/routers/uploads.py`
- Modify: `apps/api/app/main.py` (add the import and `include_router` call)
- Test: `apps/api/tests/routers/test_uploads.py`

**Interfaces:**
- Consumes: `PresignRequest`, `PresignResponse` from `app.schemas.upload` (Task 1). `generate_presign` from `app.services.uploads` (Task 2). `get_current_user` from `app.dependencies.auth` (existing). `User` from `app.models.user` (existing).
- Produces: `router: APIRouter` in `app.routers.uploads`, mounted in `app.main`. Nothing later in this plan depends on it — this is the last task.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/routers/test_uploads.py`:

```python
"""Integration tests for the Uploads endpoint."""

from fastapi.testclient import TestClient

from app.services import uploads


def _register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Uploader", "email": email, "password": "securepass123"},
    )
    login = client.post("/auth/login", json={"email": email, "password": "securepass123"})
    return login.json()["access_token"]


def test_presign_requires_authentication(client: TestClient) -> None:
    """Failure path: no Authorization header returns 401 UNAUTHORIZED."""
    response = client.post(
        "/uploads/presign",
        json={"filename": "photo.jpg", "content_type": "image/jpeg"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_presign_happy_path(client: TestClient, monkeypatch) -> None:
    """Happy path: an authenticated request gets back upload_url,
    public_url, and expires_in, without ever calling real S3.
    """
    monkeypatch.setattr(
        uploads.s3_client,
        "generate_presigned_url",
        lambda *args, **kwargs: "https://fake-presigned-url.example.com/put",
    )
    token = _register_and_login(client, "uploader@example.com")

    response = client.post(
        "/uploads/presign",
        headers={"Authorization": f"Bearer {token}"},
        json={"filename": "photo.jpg", "content_type": "image/jpeg"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["upload_url"] == "https://fake-presigned-url.example.com/put"
    assert body["public_url"].endswith(".jpg")
    assert body["expires_in"] == uploads.EXPIRES_IN
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pytest tests/routers/test_uploads.py -v`
Expected: FAIL with a 404 (route doesn't exist yet) on both tests

- [ ] **Step 3: Write the router**

Create `apps/api/app/routers/uploads.py`:

```python
"""Uploads endpoint: request a pre-signed S3 URL for direct photo uploads."""

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.upload import PresignRequest, PresignResponse
from app.services.uploads import generate_presign

router = APIRouter()


@router.post("/uploads/presign")
def presign_upload(
    data: PresignRequest,
    current_user: User = Depends(get_current_user),
) -> PresignResponse:
    """Get a pre-signed URL to upload a photo directly to S3.

    Args:
        data: The filename (informational only) and content_type of the
            file the client wants to upload.
        current_user: Resolved by get_current_user — the S3 key includes
            this user's id.

    Returns:
        A pre-signed upload_url, the resulting object's permanent
        public_url, and expires_in.
    """
    return generate_presign(user_id=current_user.id, content_type=data.content_type.value)
```

- [ ] **Step 4: Wire the router into the app**

Modify `apps/api/app/main.py`:

Change:
```python
from app.routers import auth, health, items, reservations
```
to:
```python
from app.routers import auth, health, items, reservations, uploads
```

Change:
```python
app.include_router(reservations.router)
```
to:
```python
app.include_router(reservations.router)
app.include_router(uploads.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pytest tests/routers/test_uploads.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Run the full test suite**

Run: `cd apps/api && pytest -v`
Expected: All tests pass (previous count + 3 schema + 4 service + 2 router = previous total + 9)

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/routers/uploads.py apps/api/app/main.py apps/api/tests/routers/test_uploads.py
git commit -m "feat(api): wire POST /uploads/presign endpoint"
```

---

## After the plan: manual live verification (not automated)

Per this repo's convention for S3-touching work (see PR #16 in `apps/api/ROADMAP.md`'s Decisions log), once all 3 tasks pass:

1. Start MiniStack + the API locally (`docker compose -f infra/docker-compose.yml up -d`, create the bucket per that file's comment if not already done, `uvicorn app.main:app --reload`).
2. Register/login a real user, `POST /uploads/presign` with a real bearer token.
3. `PUT` an actual small image file to the returned `upload_url`, setting `Content-Type` to the same value sent in the request.
4. `GET` the returned `public_url` and confirm the bytes round-trip.
5. Clean up the test object/rows created, per the same live-verification hygiene rule already in the Decisions log.
6. Log the result in `apps/api/ROADMAP.md`'s Decisions log and Session log — do not commit that update without showing the diff first (session ritual in `apps/api/CLAUDE.md`).
