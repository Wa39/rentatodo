# Item Reactivate Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `PATCH /items/{item_id}/reactivate` in `apps/api`, the one remaining `CLAUDE_BACKEND.md` gap — flips a soft-deleted item's `is_active` back to `true`. Contract already merged (PR #77).

**Architecture:** Exact mirror of the existing `delete_item` service function and its router endpoint, with the boolean flipped. No new schema, no new model field — `Item.is_active` already exists.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, TestClient (existing patterns in `apps/api`).

## Global Constraints

- No `is_active` filter on the item lookup — owners can reactivate an already-active item too (idempotent), matching `delete_item`'s precedent (see `apps/api/ROADMAP.md` Decisions log, 2026-07-17).
- Ownership check reads `owner_id` from the authenticated JWT user, never from the request — non-negotiable per `apps/api/CLAUDE.md`.
- Response shape is `ItemResponse`, identical to `DELETE /items/{item_id}`.
- No request body (contract: `packages/contracts/openapi.yaml:773`, `operationId: reactivateItem`).
- Docstrings: Google/NumPy-style, matching the existing file's convention (see `delete_item`'s docstring in `app/services/items.py:266`).

---

### Task 1: `reactivate_item` service function + tests

**Files:**
- Modify: `apps/api/app/services/items.py` (add function after `delete_item`, which ends at line 292)
- Test: `apps/api/tests/services/test_items.py` (add tests after the `delete_item` tests, which end at line 511)

**Interfaces:**
- Consumes: `Item` model (`app/models/item.py`), `AppError` (`app/exceptions.py`), `_fetch_item_with_owner(db, item_id) -> Item` (`app/services/items.py:18`) — all already imported at the top of `items.py`.
- Produces: `reactivate_item(db: Session, item_id: uuid.UUID, owner_id: uuid.UUID) -> Item`, for Task 2's router to call.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/tests/services/test_items.py`, after `test_delete_item_raises_forbidden_for_non_owner` (line 511):

```python
def test_reactivate_item_sets_is_active_true(db_session: Session, make_user, make_item) -> None:
    """Happy path: reactivate_item flips is_active back to True."""
    from app.services.items import reactivate_item

    owner = make_user(email="reactivator1@example.com")
    item = make_item(owner_id=owner.id, is_active=False)

    reactivated = reactivate_item(db_session, item_id=item.id, owner_id=owner.id)

    assert reactivated.is_active is True


def test_reactivate_item_is_idempotent(db_session: Session, make_user, make_item) -> None:
    """Edge case: reactivating an already-active item succeeds without
    raising, and stays active.
    """
    from app.services.items import reactivate_item

    owner = make_user(email="reactivator2@example.com")
    item = make_item(owner_id=owner.id, is_active=True)

    reactivated = reactivate_item(db_session, item_id=item.id, owner_id=owner.id)

    assert reactivated.is_active is True


def test_reactivate_item_raises_forbidden_for_non_owner(
    db_session: Session, make_user, make_item
) -> None:
    """Failure path: a non-owner cannot reactivate someone else's item."""
    from app.services.items import reactivate_item

    owner = make_user(email="owner-real3@example.com")
    other = make_user(email="owner-other3@example.com")
    item = make_item(owner_id=owner.id, is_active=False)

    with pytest.raises(AppError) as exc_info:
        reactivate_item(db_session, item_id=item.id, owner_id=other.id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"


def test_reactivate_item_raises_not_found_for_missing_id(
    db_session: Session, make_user
) -> None:
    """Failure path: reactivating a nonexistent item raises 404 NOT_FOUND."""
    from app.services.items import reactivate_item

    owner = make_user(email="owner-real4@example.com")

    with pytest.raises(AppError) as exc_info:
        reactivate_item(db_session, item_id=uuid.uuid4(), owner_id=owner.id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "NOT_FOUND"
```

Check the top of `apps/api/tests/services/test_items.py` already imports `uuid`, `pytest`, and `AppError` (it must, since `test_delete_item_raises_forbidden_for_non_owner` uses both `pytest.raises` and `AppError`) — no new imports needed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pytest tests/services/test_items.py -k reactivate -v`
Expected: FAIL with `ImportError: cannot import name 'reactivate_item'`

- [ ] **Step 3: Write minimal implementation**

Add to `apps/api/app/services/items.py`, directly after `delete_item` (after line 292):

```python
def reactivate_item(db: Session, item_id: uuid.UUID, owner_id: uuid.UUID) -> Item:
    """Reactivate a soft-deleted item by setting ``is_active = True``.
    Idempotent — reactivating an already-active item just re-confirms
    the same state.

    Args:
        db: Database session.
        item_id: The item's id.
        owner_id: The authenticated caller's id — must match the item's
            owner, or the reactivation is refused.

    Returns:
        The reactivated Item.

    Raises:
        AppError: 404 NOT_FOUND if no item exists with that id. 403
            FORBIDDEN if the item exists but ``owner_id`` isn't its owner.
    """
    item = db.scalar(select(Item).where(Item.id == item_id))
    if item is None:
        raise AppError(404, "NOT_FOUND", "Item not found")
    if item.owner_id != owner_id:
        raise AppError(403, "FORBIDDEN", "You do not own this item")

    item.is_active = True
    db.commit()
    return _fetch_item_with_owner(db, item.id)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pytest tests/services/test_items.py -k reactivate -v`
Expected: 4 passed

- [ ] **Step 5: Run the full service test file to check for regressions**

Run: `cd apps/api && pytest tests/services/test_items.py -v`
Expected: all pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/services/items.py apps/api/tests/services/test_items.py
git commit -m "feat(api): add reactivate_item service function"
```

---

### Task 2: Router wiring + integration tests

**Files:**
- Modify: `apps/api/app/routers/items.py` (add import + endpoint after `delete_item_endpoint`, which ends at line 159)
- Test: `apps/api/tests/routers/test_items.py` (add tests after `test_delete_item_returns_404_for_missing_id`, which ends at line 268)

**Interfaces:**
- Consumes: `reactivate_item(db, item_id, owner_id) -> Item` from Task 1.
- Produces: `PATCH /items/{item_id}/reactivate` endpoint, returning `ItemResponse`, consumed by API clients (mobile/web) — no other in-repo consumer.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/tests/routers/test_items.py`, after `test_delete_item_returns_404_for_missing_id` (line 268):

```python
def test_reactivate_item_happy_path_activates(client: TestClient) -> None:
    """Happy path: PATCH .../reactivate sets is_active=True and returns the item."""
    token = _register_and_login(client, "reactivator1@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "A reactivar",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]
    client.delete(f"/items/{item_id}", headers={"Authorization": f"Bearer {token}"})

    response = client.patch(
        f"/items/{item_id}/reactivate", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is True


def test_reactivate_item_returns_404_for_missing_id(client: TestClient) -> None:
    """Failure path: reactivating a nonexistent item returns 404 NOT_FOUND."""
    token = _register_and_login(client, "reactivator2@example.com")

    response = client.patch(
        "/items/00000000-0000-0000-0000-000000000000/reactivate",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_reactivate_item_returns_403_for_non_owner(client: TestClient) -> None:
    """Failure path: a non-owner cannot reactivate someone else's item."""
    token = _register_and_login(client, "reactivator3@example.com")
    other_token = _register_and_login(client, "reactivator3-other@example.com")
    create_response = client.post(
        "/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Ajeno",
            "description": "Descripcion",
            "category": "tools",
            "price_per_day": 5000,
            "photo_url": "https://example.com/photo.jpg",
        },
    )
    item_id = create_response.json()["id"]
    client.delete(f"/items/{item_id}", headers={"Authorization": f"Bearer {token}"})

    response = client.patch(
        f"/items/{item_id}/reactivate", headers={"Authorization": f"Bearer {other_token}"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pytest tests/routers/test_items.py -k reactivate -v`
Expected: FAIL with 404 (route doesn't exist yet — FastAPI returns 404 for an unmatched path)

- [ ] **Step 3: Write minimal implementation**

In `apps/api/app/routers/items.py`, update the import block (lines 20-28) to add `reactivate_item`:

```python
from app.services.items import (
    create_item,
    delete_item,
    get_item,
    get_unavailable_dates,
    list_items,
    list_my_items,
    reactivate_item,
    update_item,
)
```

Then add the endpoint directly after `delete_item_endpoint` (after line 159):

```python
@router.patch("/items/{item_id}/reactivate")
def reactivate_item_endpoint(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Reactivate a soft-deleted item (is_active=True). Only the owner may reactivate.

    Args:
        item_id: The item's id.
        current_user: Resolved by get_current_user — must be the item's owner.
        db: Database session injected by FastAPI.

    Returns:
        The reactivated item's public representation.
    """
    item = reactivate_item(db, item_id=item_id, owner_id=current_user.id)
    return ItemResponse.model_validate(item)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pytest tests/routers/test_items.py -k reactivate -v`
Expected: 3 passed

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd apps/api && pytest -v`
Expected: all pass (193 previous + 4 service + 3 router = 200 total), no regressions

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/items.py apps/api/tests/routers/test_items.py
git commit -m "feat(api): wire PATCH /items/{item_id}/reactivate endpoint"
```

---

### Task 3: Manual live verification + push + open PR

**Files:** None (verification + git/PR operations only).

**Interfaces:** None — this task consumes the finished endpoint from Tasks 1-2 and produces a pushed branch + open PR.

- [ ] **Step 1: Start the API against real Postgres**

From `apps/api` (with the venv active, `.env` configured, `infra/docker-compose.yml` DB already up):

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

- [ ] **Step 2: Manually verify the happy path and idempotency live**

In another terminal, register a user, log in, publish an item, delete it, then reactivate it twice:

```bash
curl -s -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Live Test","email":"livetest-reactivate@example.com","password":"securepass123"}'

TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"livetest-reactivate@example.com","password":"securepass123"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

ITEM_ID=$(curl -s -X POST http://localhost:8000/items -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Live Item","description":"desc","category":"tools","price_per_day":1000,"photo_url":"https://example.com/p.jpg"}' | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

curl -s -X DELETE http://localhost:8000/items/$ITEM_ID -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:8000/items/$ITEM_ID/reactivate -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:8000/items/$ITEM_ID/reactivate -H "Authorization: Bearer $TOKEN"
```

Expected: both reactivate calls return `200` with `"is_active": true`.

- [ ] **Step 3: Clean up the live-verification row**

Delete the test item and note there's no user-delete endpoint, so the test user row is left in the DB — acceptable for a local dev DB, but confirm the item ends in a known state:

```bash
curl -s -X DELETE http://localhost:8000/items/$ITEM_ID -H "Authorization: Bearer $TOKEN"
```

Stop `uvicorn`.

- [ ] **Step 4: Re-run the full automated suite to confirm no pollution**

Run: `cd apps/api && pytest -v`
Expected: all pass, same count as Task 2 Step 5.

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feature/item-reactivate-endpoint
```

- [ ] **Step 6: Open the PR**

```bash
gh pr create --base develop --title "feat(api): implement PATCH /items/{item_id}/reactivate" --body "$(cat <<'EOF'
## Summary
- Implements the one remaining CLAUDE_BACKEND.md gap: reactivating a soft-deleted item.
- Mirrors delete_item's shape exactly (owner-only, idempotent, no is_active filter on lookup) per PR #77's contract.

## Test plan
- 4 new service tests (happy path, idempotent, 403 non-owner, 404 missing) + 3 new router tests (happy path, 404, 403).
- Full suite green (200/200).
- Manually verified live against real Postgres: reactivate after delete, called twice (idempotent), 200 both times.
EOF
)"
```

- [ ] **Step 7: Update ROADMAP.md**

Per `apps/api/CLAUDE.md`'s session ritual, move this item from "Next up" to "Done", add a "Current focus" update, and log a Session log entry with today's date — then show the diff for review rather than committing it directly (per the same ritual).
