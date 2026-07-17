# Items follow-up (PATCH / DELETE / GET my items) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 3 remaining Week 1 Items endpoints — `PATCH /items/{item_id}`, `DELETE /items/{item_id}`, `GET /users/me/items` — closing out `CLAUDE_BACKEND.md`'s 9-endpoint "Week 1" grouping.

**Architecture:** Extends the existing Items slice (schema → service → router), no new files. Same layered pattern as `POST`/`GET /items`: routers stay thin, services own the ownership checks and DB writes, `AppError` produces the contract's error shape.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, pytest, real Postgres via Docker Compose (no mocks).

## Global Constraints

- All error responses use `AppError(status_code, code, message)` → `{"error": {"code": ..., "message": ...}}` — never a raw exception or FastAPI's default 4xx shape.
- `owner_id` for authorization always comes from `get_current_user` (JWT), never from the request body or path.
- Existence is always checked before ownership: a nonexistent item is `404 NOT_FOUND` even for a non-owner; an existing item owned by someone else is `403 FORBIDDEN`.
- No new response schemas — every endpoint here returns the existing `ItemResponse` (or a list of it).
- Soft delete only: `DELETE` sets `is_active = False`, never removes the row.
- `PATCH`/`DELETE` do not filter by `is_active` when looking up the item — owners can act on an inactive item too.
- `GET /users/me/items` returns a bare `list[ItemResponse]` (no pagination envelope), per `packages/contracts/openapi.yaml:728-749`.

---

### Task 1: `UpdateItemRequest` schema

**Files:**
- Modify: `apps/api/app/schemas/item.py:34` (insert after `CreateItemRequest`, before `ItemResponse`)
- Modify: `apps/api/tests/schemas/test_item.py`

**Interfaces:**
- Consumes: `CategoryEnum` (already defined in this file).
- Produces: `UpdateItemRequest` (`name`, `description`, `category`, `price_per_day`, `photo_url`, all `| None`, default `None`) — used by Task 2's `update_item` and Task 3's router.

- [ ] **Step 1: Write the failing tests**

Add this import to the existing import line at the top of `apps/api/tests/schemas/test_item.py`:

```python
from app.schemas.item import (
    CategoryEnum,
    CreateItemRequest,
    ItemDetailResponse,
    ItemResponse,
    UpdateItemRequest,
)
```

Append these tests to the end of `apps/api/tests/schemas/test_item.py`:

```python
def test_update_item_request_accepts_partial_payload() -> None:
    """Happy path: only name is provided; every other field defaults to
    None, meaning "leave unchanged".
    """
    request = UpdateItemRequest(name="Nuevo nombre")

    assert request.name == "Nuevo nombre"
    assert request.description is None
    assert request.category is None
    assert request.price_per_day is None
    assert request.photo_url is None


def test_update_item_request_accepts_empty_payload() -> None:
    """Edge case: an empty payload is valid — every field is optional."""
    request = UpdateItemRequest()

    assert request.name is None


def test_update_item_request_rejects_invalid_price_when_provided() -> None:
    """Failure path: price_per_day, if sent, must still be > 0."""
    with pytest.raises(ValidationError):
        UpdateItemRequest(price_per_day=0)


def test_update_item_request_rejects_invalid_category_when_provided() -> None:
    """Failure path: category, if sent, must still be a real CategoryEnum value."""
    with pytest.raises(ValidationError):
        UpdateItemRequest(category="not-a-real-category")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/schemas/test_item.py -v`
Expected: FAIL — `ImportError: cannot import name 'UpdateItemRequest' from 'app.schemas.item'`.

- [ ] **Step 3: Add `UpdateItemRequest` to `app/schemas/item.py`**

Insert this class between `CreateItemRequest` and `ItemResponse` (i.e. after line 34, `photo_url: AnyUrl = Field(..., description="URL to the item's photo.")`, before `class ItemResponse(BaseModel):`):

```python
class UpdateItemRequest(BaseModel):
    """Payload for PATCH /items/{item_id}. Every field is optional —
    an omitted field (or an explicit None) means "leave this field
    unchanged". Only send the fields you want to change.
    """

    name: str | None = Field(None, min_length=1, description="Short display name.")
    description: str | None = Field(None, min_length=1, description="Full text description.")
    category: CategoryEnum | None = Field(None, description="One of the closed set of categories.")
    price_per_day: int | None = Field(
        None, gt=0, description="Price in USD centavos. 5000 = $50.00."
    )
    photo_url: AnyUrl | None = Field(None, description="URL to the item's photo.")
```

- [ ] **Step 4: Run tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/schemas/test_item.py -v`
Expected: `10 passed` (6 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add app/schemas/item.py tests/schemas/test_item.py
git commit -m "feat(api): add UpdateItemRequest schema"
```

---

### Task 2: `update_item`, `delete_item`, `list_my_items` service functions

**Files:**
- Modify: `apps/api/app/services/items.py`
- Modify: `apps/api/tests/services/test_items.py`

**Interfaces:**
- Consumes: `app.models.item.Item`, `app.schemas.item.UpdateItemRequest`, `app.exceptions.AppError`, the existing `make_user`/`make_item` fixtures.
- Produces: `update_item(db, item_id: uuid.UUID, owner_id: uuid.UUID, data: UpdateItemRequest) -> Item`, `delete_item(db, item_id: uuid.UUID, owner_id: uuid.UUID) -> Item`, `list_my_items(db, owner_id: uuid.UUID) -> list[Item]` (all raise `AppError`) — used by Task 3's router.

- [ ] **Step 1: Write the failing tests**

Add this import to the top of `apps/api/tests/services/test_items.py` (alongside the existing `from app.schemas.item import CreateItemRequest`):

```python
from app.schemas.item import CreateItemRequest, UpdateItemRequest
```

Append these tests to the end of `apps/api/tests/services/test_items.py`:

```python
def test_update_item_updates_only_sent_fields(db_session: Session, make_user, make_item) -> None:
    """Happy path: only the fields present in the payload change; the
    rest keep their original value.
    """
    from app.services.items import update_item

    owner = make_user(email="updater1@example.com")
    item = make_item(owner_id=owner.id, name="Original", price_per_day=5000)
    data = UpdateItemRequest(name="Actualizado")

    updated = update_item(db_session, item_id=item.id, owner_id=owner.id, data=data)

    assert updated.name == "Actualizado"
    assert updated.price_per_day == 5000


def test_update_item_raises_not_found_for_missing_id(db_session: Session, make_user) -> None:
    """Failure path: a nonexistent item id raises 404 NOT_FOUND."""
    from app.services.items import update_item

    owner = make_user(email="updater2@example.com")
    data = UpdateItemRequest(name="No importa")

    with pytest.raises(AppError) as exc_info:
        update_item(db_session, item_id=uuid.uuid4(), owner_id=owner.id, data=data)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"


def test_update_item_raises_forbidden_for_non_owner(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a caller who isn't the item's owner gets 403
    FORBIDDEN, not a silent update.
    """
    from app.services.items import update_item

    owner = make_user(email="owner-real@example.com")
    other = make_user(email="owner-other@example.com")
    item = make_item(owner_id=owner.id)
    data = UpdateItemRequest(name="Hackeado")

    with pytest.raises(AppError) as exc_info:
        update_item(db_session, item_id=item.id, owner_id=other.id, data=data)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_delete_item_sets_is_active_false(db_session: Session, make_user, make_item) -> None:
    """Happy path: delete_item soft-deletes, never removes the row."""
    from app.services.items import delete_item

    owner = make_user(email="deleter1@example.com")
    item = make_item(owner_id=owner.id, is_active=True)

    deleted = delete_item(db_session, item_id=item.id, owner_id=owner.id)

    assert deleted.is_active is False


def test_delete_item_is_idempotent(db_session: Session, make_user, make_item) -> None:
    """Edge case: deleting an already-inactive item succeeds without
    raising, and stays inactive.
    """
    from app.services.items import delete_item

    owner = make_user(email="deleter2@example.com")
    item = make_item(owner_id=owner.id, is_active=False)

    deleted = delete_item(db_session, item_id=item.id, owner_id=owner.id)

    assert deleted.is_active is False


def test_delete_item_raises_forbidden_for_non_owner(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a non-owner cannot delete someone else's item."""
    from app.services.items import delete_item

    owner = make_user(email="owner-real2@example.com")
    other = make_user(email="owner-other2@example.com")
    item = make_item(owner_id=owner.id)

    with pytest.raises(AppError) as exc_info:
        delete_item(db_session, item_id=item.id, owner_id=other.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_list_my_items_includes_active_and_inactive(
    db_session: Session, make_user, make_item
) -> None:
    """Happy path: list_my_items returns both active and inactive items
    for the given owner.
    """
    from app.services.items import list_my_items

    owner = make_user(email="myitems1@example.com")
    make_item(owner_id=owner.id, name="Activo", is_active=True)
    make_item(owner_id=owner.id, name="Inactivo", is_active=False)

    items = list_my_items(db_session, owner_id=owner.id)

    assert {item.name for item in items} == {"Activo", "Inactivo"}


def test_list_my_items_excludes_other_owners(db_session: Session, make_user, make_item) -> None:
    """Failure/edge path: another owner's items never show up."""
    from app.services.items import list_my_items

    owner = make_user(email="myitems2@example.com")
    other = make_user(email="myitems3@example.com")
    make_item(owner_id=owner.id, name="Mio")
    make_item(owner_id=other.id, name="Ajeno")

    items = list_my_items(db_session, owner_id=owner.id)

    assert [item.name for item in items] == ["Mio"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_items.py -v`
Expected: FAIL — `ImportError: cannot import name 'update_item' from 'app.services.items'` (and similarly for `delete_item`, `list_my_items`).

- [ ] **Step 3: Add the 3 functions to `app/services/items.py`**

Change the existing schema import near the top of `apps/api/app/services/items.py` from:

```python
from app.schemas.item import CreateItemRequest
```

to:

```python
from app.schemas.item import CreateItemRequest, UpdateItemRequest
```

Then append to the end of `apps/api/app/services/items.py`:

```python
def update_item(
    db: Session, item_id: uuid.UUID, owner_id: uuid.UUID, data: UpdateItemRequest
) -> Item:
    """Edit an item's fields. Only the fields present in ``data`` change.

    Args:
        db: Database session.
        item_id: The item's id.
        owner_id: The authenticated caller's id — must match the item's
            owner, or the edit is refused.
        data: Only the fields to change; a field left as ``None`` is
            treated as "not sent" and keeps its current value.

    Returns:
        The updated Item.

    Raises:
        AppError: 404 NOT_FOUND if no item exists with that id. 403
            FORBIDDEN if the item exists but ``owner_id`` isn't its owner.
    """
    item = db.scalar(select(Item).where(Item.id == item_id))
    if item is None:
        raise AppError(404, "NOT_FOUND", "Item not found")
    if item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")

    if data.name is not None:
        item.name = data.name
    if data.description is not None:
        item.description = data.description
    if data.category is not None:
        item.category = data.category.value
    if data.price_per_day is not None:
        item.price_per_day = data.price_per_day
    if data.photo_url is not None:
        item.photo_url = str(data.photo_url)

    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: uuid.UUID, owner_id: uuid.UUID) -> Item:
    """Soft-delete an item by setting ``is_active = False``. Never removes
    the row. Idempotent — deleting an already-inactive item just
    re-confirms the same state.

    Args:
        db: Database session.
        item_id: The item's id.
        owner_id: The authenticated caller's id — must match the item's
            owner, or the delete is refused.

    Returns:
        The deactivated Item.

    Raises:
        AppError: 404 NOT_FOUND if no item exists with that id. 403
            FORBIDDEN if the item exists but ``owner_id`` isn't its owner.
    """
    item = db.scalar(select(Item).where(Item.id == item_id))
    if item is None:
        raise AppError(404, "NOT_FOUND", "Item not found")
    if item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")

    item.is_active = False
    db.commit()
    db.refresh(item)
    return item


def list_my_items(db: Session, owner_id: uuid.UUID) -> list[Item]:
    """List every item an owner has published, active or not.

    Args:
        db: Database session.
        owner_id: The authenticated caller's id.

    Returns:
        All of the owner's items, newest first.
    """
    query = (
        select(Item)
        .options(joinedload(Item.owner))
        .where(Item.owner_id == owner_id)
        .order_by(Item.created_at.desc())
    )
    return list(db.scalars(query).unique())
```

- [ ] **Step 4: Run tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/services/test_items.py -v`
Expected: `25 passed` (17 existing + 8 new).

- [ ] **Step 5: Commit**

```bash
git add app/services/items.py tests/services/test_items.py
git commit -m "feat(api): add update_item, delete_item, list_my_items service functions"
```

---

### Task 3: Router — wire the 3 endpoints together

**Files:**
- Modify: `apps/api/app/routers/items.py`
- Modify: `apps/api/tests/routers/test_items.py`

**Interfaces:**
- Consumes: everything from Tasks 1-2, plus `app.dependencies.auth.get_current_user`.
- Produces: the 3 live HTTP endpoints (`PATCH /items/{item_id}`, `DELETE /items/{item_id}`, `GET /users/me/items`).

- [ ] **Step 1: Write the failing tests**

Append these tests to the end of `apps/api/tests/routers/test_items.py`:

```python
def test_update_item_happy_path_updates_only_sent_field(client: TestClient) -> None:
    """Happy path: PATCH with only one field changes just that field."""
    token = _register_and_login(client, "patcher1@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Original",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.patch(
        f"/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Actualizado"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Actualizado"
    assert body["price_per_day"] == 5000


def test_update_item_returns_403_for_non_owner(client: TestClient) -> None:
    """Failure path: a different authenticated user cannot edit this item."""
    owner_token = _register_and_login(client, "patcher-owner@example.com")
    other_token = _register_and_login(client, "patcher-other@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Original",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.patch(
        f"/items/{item_id}",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"name": "Hackeado"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_delete_item_happy_path_deactivates(client: TestClient) -> None:
    """Happy path: DELETE sets is_active=False and returns the item."""
    token = _register_and_login(client, "deleter1@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "A borrar",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]

    response = client.delete(f"/items/{item_id}", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_delete_item_returns_404_for_missing_id(client: TestClient) -> None:
    """Failure path: deleting a nonexistent item returns 404 NOT_FOUND."""
    token = _register_and_login(client, "deleter2@example.com")

    response = client.delete(
        "/items/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_list_my_items_requires_authentication(client: TestClient) -> None:
    """Failure path: no token returns 401 UNAUTHORIZED."""
    response = client.get("/users/me/items")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_list_my_items_happy_path_includes_inactive_excludes_others(client: TestClient) -> None:
    """Happy path: my items list includes both an active and a
    soft-deleted item of mine, but not another user's item.
    """
    token = _register_and_login(client, "myitems-router@example.com")
    other_token = _register_and_login(client, "myitems-router-other@example.com")
    client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Activo",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    to_delete_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Para borrar",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    client.delete(
        f"/items/{to_delete_response.json()['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        "/items",
        headers={"Authorization": f"Bearer {other_token}"},
        json={
            "name": "Ajeno",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )

    response = client.get("/users/me/items", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert names == {"Activo", "Para borrar"}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/routers/test_items.py -v`
Expected: FAIL — `404 Not Found` / `405 Method Not Allowed` on the new routes (they don't exist yet).

- [ ] **Step 3: Wire the 3 endpoints into `app/routers/items.py`**

Update the imports at the top of `apps/api/app/routers/items.py` — replace:

```python
from app.schemas.item import (
    CategoryEnum,
    CreateItemRequest,
    ItemDetailResponse,
    ItemListResponse,
    ItemResponse,
)
from app.services.items import create_item, get_item, list_items
```

with:

```python
from app.schemas.item import (
    CategoryEnum,
    CreateItemRequest,
    ItemDetailResponse,
    ItemListResponse,
    ItemResponse,
    UpdateItemRequest,
)
from app.services.items import (
    create_item,
    delete_item,
    get_item,
    list_items,
    list_my_items,
    update_item,
)
```

Append these 3 endpoints to the end of `apps/api/app/routers/items.py`:

```python
@router.patch("/items/{item_id}")
def update_item_endpoint(
    item_id: UUID,
    data: UpdateItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Edit an item's own fields. Only the owner may edit.

    Args:
        item_id: The item's id.
        data: Only the fields to change; omitted fields are left as-is.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The updated item's public representation.
    """
    item = update_item(db, item_id=item_id, owner_id=current_user.id, data=data)
    return ItemResponse.model_validate(item)


@router.delete("/items/{item_id}")
def delete_item_endpoint(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Soft-delete an item (is_active=False). Only the owner may delete.

    Args:
        item_id: The item's id.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The deactivated item's public representation.
    """
    item = delete_item(db, item_id=item_id, owner_id=current_user.id)
    return ItemResponse.model_validate(item)


@router.get("/users/me/items")
def list_my_items_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    """List every item the authenticated user owns, active or not.

    Args:
        current_user: Resolved by get_current_user.
        db: Database session injected by FastAPI.

    Returns:
        All of the caller's items, active and inactive.
    """
    items = list_my_items(db, owner_id=current_user.id)
    return [ItemResponse.model_validate(item) for item in items]
```

- [ ] **Step 4: Run tests again to verify they pass**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest tests/routers/test_items.py -v`
Expected: `13 passed` (7 existing + 6 new).

- [ ] **Step 5: Run the full suite**

Run: `cd apps/api && venv/Scripts/python.exe -m pytest -v`
Expected: all tests pass (65 existing + 4 + 8 + 6 = 83).

- [ ] **Step 6: Commit**

```bash
git add app/routers/items.py tests/routers/test_items.py
git commit -m "feat(api): add PATCH/DELETE items and GET users/me/items endpoints"
```

---

## After this plan

- Update `apps/api/ROADMAP.md`: move this piece of work from "Next up" to
  "Done", note `CLAUDE_BACKEND.md`'s Week 1 (9/9 endpoints) is now fully
  closed. Show the diff to Jose per the session ritual — don't commit it
  without approval.
- Push `feature/items-followup`, open a PR against `develop`.
- Next real piece of work: Reservations (Week 2), scoped to
  `CLAUDE_BACKEND.md`'s own 6-endpoint Week 2 grouping (`POST
  /items/{id}/reservations`, `GET /users/me/reservations`, `GET
  /users/me/requests`, `PATCH .../approve`, `PATCH .../reject`, `PATCH
  .../cancel`) — brainstorm → spec → this same plan format, same process.
