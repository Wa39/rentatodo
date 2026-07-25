# Wire Photo Upload to the Real API — Design

## What this is

Replaces `apps/web`'s pasted-URL text field for an item's `photo_url`
with a real file-picker that uploads directly to S3 via `apps/api`'s
`POST /uploads/presign` endpoint, following the same pattern established
by `2026-07-20-web-items-crud-design.md` for Items: same `api.ts` fetch
wrapper, same `ApiError`/error-banner conventions.

Scope is `apps/web` only. `apps/api`'s `POST /uploads/presign` is already
implemented and merged to `develop` (PR #41, `1e9f542`) — nothing on the
backend needs to change for this design.

## Current state (before this change)

- `apps/web/src/routes/PublishItemPage.tsx`: a plain `<Input type="url">`
  bound to `photoUrl` state — the owner pastes an already-hosted image URL.
- `apps/web/src/routes/ItemsPage.tsx`: the edit dialog has the identical
  pasted-URL `Input` for `photo_url`.
- `apps/web/src/components/ItemCard.tsx`: never renders `item.photo_url` —
  every card shows a category-colored gradient placeholder instead, even
  in `PublishItemPage`'s "How renters will see it" live preview.
- `apps/web/src/lib/api.ts`: no upload-related function exists.

## What's live on the API (confirmed against `packages/contracts/openapi.yaml`
and `apps/api/app/routers/uploads.py`, `app/schemas/upload.py`, `app/services/uploads.py`)

- `POST /uploads/presign` — auth required (JWT via `Authorization: Bearer`).
  Body: `{ filename: string, content_type: "image/jpeg" | "image/png" | "image/webp" }`.
  `filename` is accepted but unused server-side (extension is derived from
  `content_type`, never the client-supplied name — avoids path traversal).
  Returns `200` with `{ upload_url, public_url, expires_in }`.
  `upload_url` is a pre-signed S3 `PUT` URL valid for `expires_in` seconds
  (300s / 5 minutes). **The client's `PUT` to `upload_url` must send the
  exact same `Content-Type` header as was declared in the presign request**,
  or the S3 signature fails to validate (documented gotcha in the backend's
  own design doc, `2026-07-21-uploads-presign-design.md`).
  `public_url` is the permanent, publicly-readable URL to store as `photo_url`
  after a successful `PUT`.
- Errors: `401` (missing/invalid token, existing `get_current_user` dependency),
  `422` (invalid `content_type`/missing fields, existing validation handler).
  boto3/S3 failures on the *presign* call itself bubble up as an unhandled
  `500` — not expected in normal operation, surfaces via the existing
  generic `ApiError('UNKNOWN_ERROR', ...)` path in `request()`.
- The actual `PUT` to `upload_url` goes straight to S3/MiniStack, not
  through `apps/api` — its failure modes (network error, expired URL,
  wrong `Content-Type`) return non-JSON S3 error bodies and must be
  handled separately from the JSON `request()` helper.
- No file-size limit is enforced by the presigned URL (no `Content-Length`
  condition set server-side) and no content/malware scanning happens
  anywhere in the current pipeline — see "Security note" below.

## Architecture

```
User picks a file
  → PhotoUploadField validates client-side (type + size + real image check)
  → uploadPhoto(token, file):
      1. apiPresignUpload(token, filename, contentType)  [POST /uploads/presign]
      2. fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
      3. return public_url
  → caller (PublishItemPage / ItemsPage edit dialog) sets photo_url = public_url
  → ItemCard renders photo_url as the card's image
```

### `apps/web/src/lib/api.ts`

Add:
```ts
export interface PresignResponse {
  upload_url: string
  public_url: string
  expires_in: number
}

export function apiPresignUpload(
  token: string,
  filename: string,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<PresignResponse> {
  return request('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, content_type: contentType }),
    headers: { Authorization: `Bearer ${token}` },
  })
}
```
Reuses the existing `request()` helper — same JSON error shape, same
`ApiError` conventions as every other endpoint call in this file.

### `apps/web/src/lib/uploadPhoto.ts` (new)

`uploadPhoto(token: string, file: File): Promise<string>`:

1. **Type check**: `file.type` must be one of the three allowed MIME types
   (matches the client-visible `accept` attribute on the file input).
   Reject otherwise with `ApiError('INVALID_FILE_TYPE', ...)`.
2. **Size check**: reject files over 5MB with
   `ApiError('FILE_TOO_LARGE', ...)`.
3. **Signature check**: read the first 12 bytes via
   `file.slice(0, 12).arrayBuffer()` and verify they match the real magic
   bytes for the claimed type (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`,
   WEBP `52 49 46 46 .... 57 45 42 50`). Catches a renamed non-image file
   whose `file.type` the browser inferred from its `.jpg`/`.png` extension.
   Reject mismatches with `ApiError('INVALID_FILE_TYPE', ...)`.
4. **Decode check**: `await createImageBitmap(file)` — if it rejects, the
   browser couldn't decode real image data out of it; reject with the
   same `INVALID_FILE_TYPE` error. The resulting `ImageBitmap` doubles as
   the source for `PhotoUploadField`'s preview thumbnail (drawn to a
   `<canvas>` or converted via `URL.createObjectURL(file)` for the `<img>`
   preview — implementation detail for the plan).
5. Call `apiPresignUpload(token, file.name, file.type as ...)`.
6. `PUT` the raw `file` to `upload_url` with `Content-Type: file.type` via
   plain `fetch` (not `request()` — S3's response isn't the API's JSON
   error shape). Non-2xx or thrown network error →
   `ApiError('UPLOAD_FAILED', ...)`.
7. Return `public_url`.

### `apps/web/src/components/PhotoUploadField.tsx` (new)

Props: `id: string`, `label: string`, `value: string`, `onChange: (url: string) => void`, `token: string`, `disabled?: boolean`.

- A hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`
  behind a `Button` labeled "Choose photo" (or "Replace photo" once
  `value` is set).
- A thumbnail `<img>`: shows the local preview immediately on selection
  (before upload finishes), replaced by the real `public_url` once
  `uploadPhoto` resolves. Empty state shows nothing (parent form's
  `required` validation, described below, still gates submission).
- Internal state machine: `idle → validating → uploading → idle` (success,
  calls `onChange(public_url)`) or `→ error` (shows the message inline,
  file input re-enabled to retry — form is not blocked from retrying).
- While `uploading`, the "Choose/Replace photo" button and the field are
  disabled; the parent form's own submit button already goes through its
  existing `disabled={submitting}` path and additionally must not be
  submittable while a photo upload is in flight (new local state check in
  each page, e.g. `disabled={submitting || photoUploading}`).

### Wiring into existing screens

- **`PublishItemPage.tsx`**: replace the pasted-URL `Input` (currently
  `id="publish-photo"`) with `<PhotoUploadField id="publish-photo" label={t.publish.photo} value={photoUrl} onChange={setPhotoUrl} token={token} />`.
  Needs `token` from `useAuth()` (already available via context, not
  currently destructured in this file — add it). Submit stays gated on
  `photoUrl` being non-empty (same `required` semantics as today, now
  satisfied only after a successful upload) plus the new
  `photoUploading` guard above.
- **`ItemsPage.tsx`** edit dialog: replace the `item-photo` `Input` the
  same way. Needs `token` from `useAuth()` (not currently imported in
  this file — add it).
- **`ItemCard.tsx`**: render `item.photo_url` as an `<img>` filling the
  current placeholder's space when non-empty; `onError` falls back to
  today's gradient-placeholder markup (handles empty string and broken
  URLs identically — both are "no usable photo").

### i18n (`apps/web/src/lib/i18n/en.ts`)

Add under `publish`: `photoChoose: 'Choose photo'`, `photoReplace: 'Replace photo'`,
`photoUploading: 'Uploading…'`, `photoInvalidType: 'Please choose a JPEG, PNG, or WEBP image.'`,
`photoTooLarge: 'Image must be smaller than 5MB.'`, `photoUploadFailed: 'Upload failed. Please try again.'`.
`ItemsPage.tsx`'s edit dialog currently hardcodes its labels in English
directly (not via `t.*`) — the photo field there follows that file's
existing local convention rather than introducing partial inconsistency
in just one field.

## Error handling

- Invalid type / too large / failed signature or decode check: caught
  before any network call, shown inline in `PhotoUploadField`, file input
  stays usable to retry — no partial form state lost.
- `401`/`422` from presign: surfaces through the existing `ApiError` →
  `getErrorMessage()` path already used everywhere else.
- S3 `PUT` failure (network, expired URL — unlikely given the picker-to-
  upload flow is seconds, not minutes, but possible on a slow connection):
  shown as `t.publish.photoUploadFailed`, retryable by picking the file
  again (a fresh presign is requested each attempt, so an expired
  `upload_url` is a non-issue on retry).

## Security note (informational — no code change here)

Client-side type/signature/decode checks catch accidental or careless
misuse (wrong file type, renamed non-image, corrupt file) but are not a
security boundary: anyone can call `POST /uploads/presign` and `PUT`
directly, bypassing every browser-side check. Neither the presign
endpoint nor anything else in the current pipeline validates uploaded
*content* server-side (no size condition on the presigned URL, no AV/
content scanning). Closing that gap requires backend or infra work
(`apps/api` and/or `infra`, S3 bucket/object scanning or a server-side
post-upload check) — out of scope for `apps/web` and for this design;
worth flagging to the team, not something this change can fix.

## Testing

- `apps/web/src/lib/uploadPhoto.test.ts` (new): valid JPEG/PNG/WEBP happy
  path (mocked `fetch` for both presign and the S3 `PUT`, mocked
  `createImageBitmap`); rejected wrong-`file.type`; rejected file with
  spoofed extension but mismatched magic bytes; rejected oversized file;
  rejected file that fails `createImageBitmap` decode; presign `401`
  propagates as `ApiError`; S3 `PUT` non-2xx propagates as
  `ApiError('UPLOAD_FAILED', ...)`.
- `PublishItemPage.test.tsx` / `ItemsPage.test.tsx`: update existing tests
  that fill the photo field to drive `PhotoUploadField` via
  `userEvent.upload(input, file)` instead of typing a URL; mock `fetch`
  for the two new calls (presign + S3 PUT) alongside the existing
  items-API mocks.
- `ItemCard.test.tsx`: add a case asserting an item with `photo_url` set
  renders an `<img>` with that `src`, and an item with an empty
  `photo_url` still renders the existing placeholder.
