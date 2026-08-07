# `POST /uploads/presign` — Design

**Date:** 2026-07-21
**Status:** Approved, ready for implementation plan

## Context

`packages/contracts/openapi.yaml` (PR #37) already defines the contract for
this endpoint: `PresignRequest` (`filename`, `content_type` enum of
`image/jpeg`/`image/png`/`image/webp`) and `PresignResponse` (`upload_url`,
`public_url`, `expires_in`). `app/s3.py` (PR #16) already has a boto3 client
configured, pointed at real AWS by default or MiniStack locally via
`AWS_ENDPOINT_URL`. `app/config.py` already has `aws_s3_bucket` (default
`rentatodo-items-wa` in `.env.example`) and `aws_s3_region`.

This endpoint is generic: it doesn't know or care whether the resulting
`public_url` ends up as `Item.photo_url`, `CheckEvidence.photo_url`, or
`Report.photo_url` (all three, per `CLAUDE_BACKEND.md`) — the client decides
that after a successful upload. No `purpose` field exists in the contract
and none is being added; extending the contract would require a new PR
with all 4 team approvals, out of scope here.

Mobile's `apps/mobile/src/data/photo-uploader.ts` already has a
`PhotoUploader` interface as the intended swap-in point once this lands —
no changes needed there as part of this piece; wiring it up is separate,
future work.

## Out of scope / dependency on Wa (infra)

No bucket policy exists anywhere in this repo granting public-read access
to uploaded objects. The `rentatodo-api` IAM user's permissions are scoped
to `PutObject` + `DeleteObject` only (per `.env.example`'s comment) — no
`GetObject` — which implies the design assumes the bucket already serves
objects as public-read (consistent with `public_url` being an unsigned,
permanent URL in the contract). Configuring that policy is infrastructure
work (`infra/` is Wa's per `CODEOWNERS`), not something this endpoint's
code does. This implementation assumes it's already true or will be
arranged separately; flagged as a message to Wa, not a blocker.

## Design

### Files

- `app/schemas/upload.py` — `PresignRequest`, `PresignResponse` (Pydantic,
  mirrors the contract's schemas field-for-field, each non-obvious field
  gets a `Field(..., description=...)`).
- `app/services/uploads.py` — the business logic (see Data flow).
- `app/routers/uploads.py` — the endpoint, wired into `app/main.py` the
  same way `items`/`reservations` are.

### Data flow

1. `PresignRequest` is parsed. `content_type` is a Pydantic enum matching
   the contract exactly — an invalid value is rejected automatically by
   the existing `RequestValidationError` handler (422), no new code
   needed for that case.
2. `get_current_user` resolves the authenticated `User` from the JWT
   (same dependency `items`/`reservations` already use). No further
   authorization check — any authenticated user may request a presigned
   URL for themselves.
3. The router calls `services.uploads.generate_presign(user_id, content_type)`.
4. The service:
   a. Maps `content_type` to a file extension via a small module-level
      dict (`{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}`).
      The extension is **never** derived from the client-supplied
      `filename` — that field is accepted per the contract but otherwise
      unused, avoiding path traversal / unsafe-character concerns entirely.
   b. Builds the S3 key: `uploads/{user_id}/{uuid4()}.{ext}`.
   c. Calls `s3_client.generate_presigned_url("put_object", Params={"Bucket": settings.aws_s3_bucket, "Key": key, "ContentType": content_type}, ExpiresIn=EXPIRES_IN)`,
      where `EXPIRES_IN = 300` (module-level constant, matches the
      contract's documented "5 minutes").
   d. Builds `public_url`: if `settings.resolved_aws_endpoint_url` is set
      (MiniStack, local dev), `f"{endpoint_url}/{bucket}/{key}"`;
      otherwise (real AWS), the virtual-hosted-style
      `f"https://{bucket}.s3.{region}.amazonaws.com/{key}"`.
   e. Returns a `PresignResponse(upload_url=..., public_url=..., expires_in=EXPIRES_IN)`.
5. Router returns `200` with that response.

**Note for the docstring:** because `ContentType` is part of the signed
params, the client's `PUT` to `upload_url` must send the *same*
`Content-Type` header it declared in the request, or the signature won't
validate. This is a real gotcha for whoever wires up mobile/web next —
worth documenting inline, not just here.

### Error handling

- `401 UNAUTHORIZED` / `401 TOKEN_EXPIRED` — unchanged, from the existing
  `get_current_user` dependency.
- `422` — unchanged, from the existing `RequestValidationError` handler,
  triggered automatically by the `content_type` enum / missing fields.
- boto3/S3 failures (bad credentials, bucket doesn't exist, network) are
  **not** caught — they bubble up as an unhandled exception into FastAPI's
  default `500`. This matches the rest of the codebase, which doesn't wrap
  infrastructure failures in `AppError` anywhere else either.

### Testing

Following the existing convention (`db_session`/`client`/`make_user`
fixtures, no boto3 mocking exists yet in this repo):

- `tests/schemas/test_upload.py` — `PresignRequest` accepts each valid
  `content_type`, rejects an invalid one.
- `tests/services/test_uploads.py` — `monkeypatch` the module-level
  `s3_client.generate_presigned_url` to a fixed fake URL; assert the key
  format (`uploads/{user_id}/{uuid}.{ext}` for each content type), assert
  `public_url` shape both with and without `AWS_ENDPOINT_URL` set (via
  monkeypatching `settings`), assert `expires_in == 300`.
- `tests/routers/test_uploads.py` — happy path (`200`, correct response
  shape, authenticated via `make_user` + a real JWT) and the most likely
  failure (missing/invalid token → `401`), per this folder's own testing
  rule (one happy path + one likely failure per piece of business logic).
- One manual live verification against a running MiniStack container
  (same pattern as PR #16's S3 client work): hit the real endpoint, `PUT`
  a file to the returned `upload_url` with the matching `Content-Type`,
  then `GET public_url` back and confirm the bytes round-trip. Logged in
  the Decisions log, not an automated test.
