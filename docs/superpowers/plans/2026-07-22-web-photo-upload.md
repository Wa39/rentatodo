# Wire Photo Upload to the Real API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web`'s pasted-URL text field for an item's photo with a real file-picker that validates the file client-side, uploads it directly to S3 via `apps/api`'s live `POST /uploads/presign` endpoint, and displays the result on item cards.

**Architecture:** A new `uploadPhoto(token, file)` function in `apps/web/src/lib` does client-side validation (MIME type, size, magic-byte signature, real-decode check) then calls a new `apiPresignUpload` (in `lib/api.ts`) and `PUT`s the file straight to the returned S3 URL. A new `PhotoUploadField` component wraps this in a file-input + preview + error UI and replaces the old URL `Input` in both `PublishItemPage` and `ItemsPage`'s edit dialog. `ItemCard` is updated to actually render `photo_url` (it currently never does).

**Tech Stack:** React + TypeScript + Vite, Vitest + `@testing-library/react` + `@testing-library/user-event`, `fetch` (no new dependencies).

## Global Constraints

- Scope is `apps/web` only — do not modify `apps/api`, `apps/mobile`, or `packages/contracts/openapi.yaml` (per root `CLAUDE.md`).
- Conventional Commits for every commit: `type(scope): description` (e.g. `feat(web): ...`).
- No hardcoded secrets/URLs/credentials — none are needed for this work.
- `apps/api`'s `POST /uploads/presign` is already implemented and merged to `develop` (PR #41) — request/response shapes below are taken directly from `apps/api/app/schemas/upload.py` and `apps/api/app/routers/uploads.py`, not guessed.
- Follow existing `apps/web` conventions exactly: the `ApiError`/`getErrorMessage` pattern in `lib/api.ts`, the `mockFetchRoutes`/`jsonResponse` test helpers already used in `PublishItemPage.test.tsx`/`ItemsPage.test.tsx`, `vi.spyOn(global, 'fetch')` + `vi.mocked(fetch)` in every test file that touches network calls.
- `ItemsPage.tsx`'s edit dialog hardcodes its field labels in plain English (not via `t.*`) — match that local convention for the one label this plan touches there ("Photo"), don't introduce partial i18n in just that file.

---

### Task 1: Add `apiPresignUpload` to `lib/api.ts`

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `export type UploadContentType = 'image/jpeg' | 'image/png' | 'image/webp'`, `export interface PresignResponse { upload_url: string; public_url: string; expires_in: number }`, `export function apiPresignUpload(token: string, filename: string, contentType: UploadContentType): Promise<PresignResponse>`.

- [ ] **Step 1: Write the failing tests**

Add this import to the top of `apps/web/src/lib/api.test.ts` (extend the existing import line):

```ts
import { ApiError, apiCreateItem, apiDeleteItem, apiGetMe, apiListMyItems, apiLogin, apiPresignUpload, apiRegister, apiUpdateItem } from './api'
```

Append this new `describe` block at the end of the file, before the final closing of the outer `describe('api', ...)` block (i.e. as a sibling of `describe('apiLogin', ...)`, `describe('apiCreateItem', ...)`, etc. — inside `describe('api', ...)`):

```ts
  describe('apiPresignUpload', () => {
    it('POSTs to /uploads/presign with filename and content_type, resolves with the presign payload', async () => {
      const payload = {
        upload_url: 'https://s3.example.com/upload?sig=abc',
        public_url: 'https://s3.example.com/uploads/u1/abc.jpg',
        expires_in: 300,
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiPresignUpload('tok123', 'photo.jpg', 'image/jpeg')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/uploads/presign',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ filename: 'photo.jpg', content_type: 'image/jpeg' }),
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } }, 401),
      )

      await expect(apiPresignUpload('bad-token', 'photo.jpg', 'image/jpeg')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid token',
      })
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `apiPresignUpload` is not exported from `./api`.

- [ ] **Step 3: Implement `apiPresignUpload` in `lib/api.ts`**

Add near the top of `apps/web/src/lib/api.ts`, after the existing `CreateItemPayload`/`UpdateItemPayload` type exports:

```ts
export type UploadContentType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface PresignResponse {
  upload_url: string
  public_url: string
  expires_in: number
}
```

Add this function at the end of the file, after `apiDeleteItem`:

```ts
export function apiPresignUpload(token: string, filename: string, contentType: UploadContentType): Promise<PresignResponse> {
  return request('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, content_type: contentType }),
    headers: { Authorization: `Bearer ${token}` },
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/lib/api.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat(web): add apiPresignUpload for POST /uploads/presign"
```

---

### Task 2: Add `uploadPhoto` client-side validation + upload flow

**Files:**
- Create: `apps/web/src/lib/uploadPhoto.ts`
- Test: `apps/web/src/lib/uploadPhoto.test.ts`

**Interfaces:**
- Consumes: `apiPresignUpload(token, filename, contentType)`, `ApiError` from `./api` (Task 1).
- Produces: `export async function uploadPhoto(token: string, file: File): Promise<string>` — resolves with `public_url`, rejects with `ApiError` whose `code` is one of `'INVALID_FILE_TYPE'`, `'FILE_TOO_LARGE'`, `'UPLOAD_FAILED'`, or whatever code the presign call itself threw (e.g. `'UNAUTHORIZED'`).

- [ ] **Step 1: Write the failing test file**

Create `apps/web/src/lib/uploadPhoto.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadPhoto } from './uploadPhoto'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function makeFile(bytes: number[], name: string, type: string, size = bytes.length): File {
  const buffer = new Uint8Array(size)
  buffer.set(bytes.slice(0, Math.min(bytes.length, size)))
  return new File([buffer], name, { type })
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]

const PRESIGN_PAYLOAD = {
  upload_url: 'https://s3.example.com/upload?sig=abc',
  public_url: 'https://s3.example.com/uploads/u1/abc.jpg',
  expires_in: 300,
}

describe('uploadPhoto', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({} as ImageBitmap))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uploads a valid JPEG: presigns, PUTs to the presigned URL with matching Content-Type, and returns public_url', async () => {
    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)

    const result = await uploadPhoto('tok123', file)

    expect(result).toBe(PRESIGN_PAYLOAD.public_url)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/uploads/presign',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ filename: 'photo.jpg', content_type: 'image/jpeg' }),
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      PRESIGN_PAYLOAD.upload_url,
      expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: file }),
    )
  })

  it('rejects a file whose declared type does not match its real signature (e.g. a renamed non-image)', async () => {
    const file = makeFile([0x00, 0x00, 0x00, 0x00], 'malware.jpg', 'image/jpeg')

    await expect(uploadPhoto('tok123', file)).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a file type outside the allowed set before checking anything else', async () => {
    const file = makeFile([0x25, 0x50, 0x44, 0x46], 'doc.pdf', 'application/pdf')

    await expect(uploadPhoto('tok123', file)).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a file over 5MB', async () => {
    const file = makeFile(JPEG_HEADER, 'huge.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)

    await expect(uploadPhoto('tok123', file)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a file with valid signature bytes that the browser cannot decode as an image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const file = makeFile(PNG_HEADER, 'broken.png', 'image/png')

    await expect(uploadPhoto('tok123', file)).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('propagates a presign failure as ApiError', async () => {
    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } }, 401),
    )

    await expect(uploadPhoto('bad-token', file)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws UPLOAD_FAILED when the S3 PUT does not return ok', async () => {
    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200))
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response)

    await expect(uploadPhoto('tok123', file)).rejects.toMatchObject({ code: 'UPLOAD_FAILED' })
  })

  it('throws UPLOAD_FAILED when the S3 PUT throws a network error', async () => {
    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200))
      .mockRejectedValueOnce(new Error('network down'))

    await expect(uploadPhoto('tok123', file)).rejects.toMatchObject({ code: 'UPLOAD_FAILED' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/uploadPhoto.test.ts`
Expected: FAIL — cannot find module `./uploadPhoto`.

- [ ] **Step 3: Implement `uploadPhoto.ts`**

Create `apps/web/src/lib/uploadPhoto.ts`:

```ts
import { apiPresignUpload, ApiError, type UploadContentType } from './api'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

type SignatureCheck = (bytes: Uint8Array) => boolean

const SIGNATURE_CHECKS: Record<UploadContentType, SignatureCheck> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/webp': (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

function isUploadContentType(type: string): type is UploadContentType {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp'
}

function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

async function matchesSignature(file: File, contentType: UploadContentType): Promise<boolean> {
  const buffer = await readAsArrayBuffer(file.slice(0, 12))
  return SIGNATURE_CHECKS[contentType](new Uint8Array(buffer))
}

/**
 * Validates a file client-side (allowed type, size, real magic-byte
 * signature, and an actual browser decode) then uploads it to S3 via
 * apps/api's presigned-URL flow. Returns the resulting public_url.
 *
 * These client-side checks are a UX safeguard against accidental/casual
 * misuse (wrong file type, renamed non-image, corrupt file) — they are
 * NOT a security boundary. Anyone can call POST /uploads/presign and PUT
 * directly, bypassing all of this. Real content/malware scanning needs
 * to happen server-side (apps/api or infra), out of scope here.
 */
export async function uploadPhoto(token: string, file: File): Promise<string> {
  if (!isUploadContentType(file.type)) {
    throw new ApiError('INVALID_FILE_TYPE', 'File type not allowed.')
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError('FILE_TOO_LARGE', 'File too large.')
  }
  if (!(await matchesSignature(file, file.type))) {
    throw new ApiError('INVALID_FILE_TYPE', 'File content does not match its declared type.')
  }
  try {
    await createImageBitmap(file)
  } catch {
    throw new ApiError('INVALID_FILE_TYPE', 'File is not a valid image.')
  }

  const presign = await apiPresignUpload(token, file.name, file.type)

  let putResponse: Response
  try {
    putResponse = await fetch(presign.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
  } catch {
    throw new ApiError('UPLOAD_FAILED', 'Upload failed.')
  }
  if (!putResponse.ok) {
    throw new ApiError('UPLOAD_FAILED', 'Upload failed.')
  }

  return presign.public_url
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/uploadPhoto.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/uploadPhoto.ts apps/web/src/lib/uploadPhoto.test.ts
git commit -m "feat(web): add uploadPhoto with client-side type/size/signature/decode validation"
```

---

### Task 3: Add `PhotoUploadField` component + i18n strings

**Files:**
- Modify: `apps/web/src/lib/i18n/en.ts`
- Create: `apps/web/src/components/PhotoUploadField.tsx`
- Test: `apps/web/src/components/PhotoUploadField.test.tsx`

**Interfaces:**
- Consumes: `uploadPhoto(token, file)` (Task 2), `ApiError`/`getErrorMessage` from `lib/api.ts`, `useTranslation` from `lib/i18n`, `Button` from `components/ui/button`, `Label` from `components/ui/label`.
- Produces: `export function PhotoUploadField(props: { id: string; label: string; value: string; onChange: (url: string) => void; onUploadingChange?: (uploading: boolean) => void; token: string }): JSX.Element`.

- [ ] **Step 1: Add the new i18n strings**

In `apps/web/src/lib/i18n/en.ts`, inside the `publish` object, change:

```ts
    photo: 'Photo',
```

to:

```ts
    photo: 'Photo',
    photoChoose: 'Choose photo',
    photoReplace: 'Replace photo',
    photoUploading: 'Uploading…',
    photoInvalidType: 'Please choose a JPEG, PNG, or WEBP image.',
    photoTooLarge: 'Image must be smaller than 5MB.',
    photoUploadFailed: 'Upload failed. Please try again.',
```

- [ ] **Step 2: Write the failing test file**

Create `apps/web/src/components/PhotoUploadField.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoUploadField } from './PhotoUploadField'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]

const PRESIGN_PAYLOAD = {
  upload_url: 'https://s3.example.com/upload?sig=abc',
  public_url: 'https://s3.example.com/uploads/u1/abc.jpg',
  expires_in: 300,
}

describe('PhotoUploadField', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({} as ImageBitmap))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows "Choose photo" and no preview when value is empty', () => {
    render(<PhotoUploadField id="photo" label="Photo" value="" onChange={vi.fn()} token="tok123" />)
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the existing photo and "Replace photo" when value is already set', () => {
    render(
      <PhotoUploadField id="photo" label="Photo" value="https://example.com/existing.jpg" onChange={vi.fn()} token="tok123" />,
    )
    expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', 'https://example.com/existing.jpg')
  })

  it('uploads a selected valid file and calls onChange with the resulting public_url', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(<PhotoUploadField id="photo" label="Photo" value="" onChange={onChange} token="tok123" />)

    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    await user.upload(screen.getByLabelText('Photo'), file)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(PRESIGN_PAYLOAD.public_url))
    expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument()
  })

  it('shows an inline error and does not call onChange when the file type is invalid', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(<PhotoUploadField id="photo" label="Photo" value="" onChange={onChange} token="tok123" />)

    const file = makeFile([0x25, 0x50, 0x44, 0x46], 'doc.pdf', 'application/pdf')
    await user.upload(screen.getByLabelText('Photo'), file)

    await waitFor(() => expect(screen.getByText('Please choose a JPEG, PNG, or WEBP image.')).toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports uploading state via onUploadingChange while the upload is in flight', async () => {
    let resolvePut: (value: Response) => void = () => {}
    const pendingPut = new Promise<Response>((resolve) => {
      resolvePut = resolve
    })
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(PRESIGN_PAYLOAD, 200)).mockReturnValueOnce(pendingPut)
    const onUploadingChange = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(
      <PhotoUploadField
        id="photo"
        label="Photo"
        value=""
        onChange={vi.fn()}
        onUploadingChange={onUploadingChange}
        token="tok123"
      />,
    )

    const file = makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg')
    await user.upload(screen.getByLabelText('Photo'), file)

    await waitFor(() => expect(onUploadingChange).toHaveBeenCalledWith(true))
    resolvePut({ ok: true, status: 200 } as Response)
    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false))
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/components/PhotoUploadField.test.tsx`
Expected: FAIL — cannot find module `./PhotoUploadField`.

- [ ] **Step 4: Implement `PhotoUploadField.tsx`**

Create `apps/web/src/components/PhotoUploadField.tsx`:

```tsx
import { useRef, useState, type ChangeEvent } from 'react'
import { ApiError, getErrorMessage } from '@/lib/api'
import { uploadPhoto } from '@/lib/uploadPhoto'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface PhotoUploadFieldProps {
  id: string
  label: string
  value: string
  onChange: (url: string) => void
  onUploadingChange?: (uploading: boolean) => void
  token: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function PhotoUploadField({ id, label, value, onChange, onUploadingChange, token }: PhotoUploadFieldProps) {
  const t = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(value)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setUploading(true)
    onUploadingChange?.(true)
    try {
      setPreview(await readAsDataUrl(file))
      const publicUrl = await uploadPhoto(token, file)
      onChange(publicUrl)
    } catch (err) {
      const knownMessages: Record<string, string> = {
        INVALID_FILE_TYPE: t.publish.photoInvalidType,
        FILE_TOO_LARGE: t.publish.photoTooLarge,
        UPLOAD_FAILED: t.publish.photoUploadFailed,
      }
      const code = err instanceof ApiError ? err.code : undefined
      setError(code && knownMessages[code] ? knownMessages[code] : getErrorMessage(err, t.errors.network))
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }

  return (
    <div className="space-y-half">
      <Label htmlFor={id}>{label}</Label>
      {preview && (
        <img src={preview} alt={label} className="h-32 w-32 rounded-md border border-border object-cover" />
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      <div>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? t.publish.photoUploading : value ? t.publish.photoReplace : t.publish.photoChoose}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/PhotoUploadField.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/i18n/en.ts apps/web/src/components/PhotoUploadField.tsx apps/web/src/components/PhotoUploadField.test.tsx
git commit -m "feat(web): add PhotoUploadField component for uploading item photos"
```

---

### Task 4: Wire `PhotoUploadField` into `PublishItemPage`

**Files:**
- Modify: `apps/web/src/routes/PublishItemPage.tsx`
- Modify: `apps/web/src/routes/PublishItemPage.test.tsx`

**Interfaces:**
- Consumes: `PhotoUploadField` (Task 3), `token` from `useAuth()` (already exposed on `AuthContextValue`).

- [ ] **Step 1: Update the failing/changed tests first**

In `apps/web/src/routes/PublishItemPage.test.tsx`:

Add this helper near the top of the file, after the `mockFetchRoutes` function:

```ts
function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]
```

In the `describe('PublishItemPage', ...)` block, change the `beforeEach`/`afterEach` to also stub `createImageBitmap`:

```ts
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({} as ImageBitmap))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
```

In the `'adds the new item to the Items list on submit'` test, add a `/uploads/presign` and S3-PUT route to `mockFetchRoutes`, and replace the photo line:

```ts
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200), () => jsonResponse([newItem], 200)],
      '/items': [() => jsonResponse(newItem, 201)],
      '/uploads/presign': [
        () =>
          jsonResponse(
            { upload_url: 'https://s3.example.com/upload-photo', public_url: 'https://example.com/photo.jpg', expires_in: 300 },
            200,
          ),
      ],
      '/upload-photo': [() => ({ ok: true, status: 200 }) as Response],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
```

(the rest of that test — the `waitFor`/`expect` after the click — stays unchanged)

In the `'shows an error banner and stays on the page when the API rejects the submission'` test, replace its whole body with:

```ts
  it('shows an error banner and stays on the page when the API rejects the submission', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/items': [
        () => jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' } }, 422),
      ],
      '/uploads/presign': [
        () =>
          jsonResponse(
            { upload_url: 'https://s3.example.com/upload-photo', public_url: 'https://example.com/photo.jpg', expires_in: 300 },
            200,
          ),
      ],
      '/upload-photo': [() => ({ ok: true, status: 200 }) as Response],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await waitFor(() => expect(screen.getByText('price_per_day: must be greater than 0')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'My items' })).not.toBeInTheDocument()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bicicleta de montaña')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/routes/PublishItemPage.test.tsx`
Expected: FAIL — `getByLabelText('Photo')` still finds a text `<input type="url">` that doesn't accept `userEvent.upload`, or the img role isn't found yet (component not changed).

- [ ] **Step 3: Update `PublishItemPage.tsx`**

Change the import line:

```ts
import { useAuth } from '@/lib/AuthContext'
```

stays the same import path, but destructure `token` too — change:

```ts
  const { user } = useAuth()
```

to:

```ts
  const { user, token } = useAuth()
```

Add a new state for the upload-in-flight guard, right after the existing `submitting`/`error` state:

```ts
  const [photoUploading, setPhotoUploading] = useState(false)
```

Add the import at the top:

```ts
import { PhotoUploadField } from '@/components/PhotoUploadField'
```

Replace this block:

```tsx
          <div className="space-y-half">
            <Label htmlFor="publish-photo">{t.publish.photo}</Label>
            <Input id="publish-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
          </div>
```

with:

```tsx
          <PhotoUploadField
            id="publish-photo"
            label={t.publish.photo}
            value={photoUrl}
            onChange={setPhotoUrl}
            onUploadingChange={setPhotoUploading}
            token={token ?? ''}
          />
```

Update the submit button's `disabled` condition from:

```tsx
            <Button type="submit" className="flex-1" disabled={submitting}>
```

to:

```tsx
            <Button type="submit" className="flex-1" disabled={submitting || !photoUrl || photoUploading}>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/routes/PublishItemPage.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Run the full web test suite to check for regressions**

Run: `cd apps/web && npx vitest run`
Expected: PASS — no other test file references the old `photoUrl` text-input behavior on this page.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/PublishItemPage.tsx apps/web/src/routes/PublishItemPage.test.tsx
git commit -m "feat(web): wire PhotoUploadField into PublishItemPage"
```

---

### Task 5: Wire `PhotoUploadField` into `ItemsPage`'s edit dialog

**Files:**
- Modify: `apps/web/src/routes/ItemsPage.tsx`
- Test: `apps/web/src/routes/ItemsPage.test.tsx` (verify only — no expected changes, see Step 1)

**Interfaces:**
- Consumes: `PhotoUploadField` (Task 3), `token` from `useAuth()`.

- [ ] **Step 1: Run the existing tests first to confirm the current baseline**

Run: `cd apps/web && npx vitest run src/routes/ItemsPage.test.tsx`
Expected: PASS (this file doesn't interact with the photo field directly today, so it should already be green before this task's changes — this step is a baseline check, not a TDD red step).

- [ ] **Step 2: Update `ItemsPage.tsx`**

Add the import at the top:

```ts
import { useAuth } from '@/lib/AuthContext'
import { PhotoUploadField } from '@/components/PhotoUploadField'
```

Add `token` and a new `photoUploading` state inside the `ItemsPage` function, right after the existing state declarations:

```ts
  const { token } = useAuth()
  const [photoUploading, setPhotoUploading] = useState(false)
```

In `openEditDialog`, reset the new state alongside the existing `setDialogError(null)`:

```ts
  function openEditDialog(item: Item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      priceDollars: String(item.price_per_day / 100),
      photoUrl: item.photo_url,
    })
    setDialogError(null)
    setPhotoUploading(false)
    setOpen(true)
  }
```

Replace this block:

```tsx
              <div className="space-y-half">
                <Label htmlFor="item-photo">Photo URL</Label>
                <Input
                  id="item-photo"
                  type="url"
                  value={form.photoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                  required
                />
              </div>
```

with:

```tsx
              <PhotoUploadField
                key={editingId ?? 'new'}
                id="item-photo"
                label="Photo"
                value={form.photoUrl}
                onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
                onUploadingChange={setPhotoUploading}
                token={token ?? ''}
              />
```

(the `key={editingId ?? 'new'}` forces a fresh `PhotoUploadField` instance — with a clean local preview state — whenever a different item is opened for editing)

Update the Save button's `disabled` condition from:

```tsx
              <Button type="submit" className="w-full" disabled={dialogSubmitting}>
```

to:

```tsx
              <Button type="submit" className="w-full" disabled={dialogSubmitting || !form.photoUrl || photoUploading}>
```

- [ ] **Step 3: Run the tests to verify no regressions**

Run: `cd apps/web && npx vitest run src/routes/ItemsPage.test.tsx`
Expected: PASS (all existing tests — none of them exercise the photo field, and every test's `ITEMS` fixture already has a non-empty `photo_url`, so the Save button's new `!form.photoUrl` guard doesn't disable anything these tests rely on).

- [ ] **Step 4: Run the full web test suite to check for regressions**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/ItemsPage.tsx
git commit -m "feat(web): wire PhotoUploadField into ItemsPage's edit dialog"
```

---

### Task 6: Render `photo_url` on `ItemCard`

**Files:**
- Modify: `apps/web/src/components/ItemCard.tsx`
- Modify: `apps/web/src/components/ItemCard.test.tsx`

**Interfaces:**
- None — purely a rendering change, no new exports.

- [ ] **Step 1: Write the failing tests**

Add these two tests to `apps/web/src/components/ItemCard.test.tsx`, inside the existing `describe('ItemCard', ...)` block:

```ts
  it('renders the photo_url as the card image when set', () => {
    const item = { ...mockItems[0], photo_url: 'https://example.com/photo.jpg' }
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.getByRole('img', { name: item.name })).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('shows no image when photo_url is empty', () => {
    const item = { ...mockItems[0], photo_url: '' }
    render(
      <RequestsProvider>
        <MemoryRouter>
          <ItemCard item={item} onEdit={vi.fn()} onDelete={vi.fn()} />
        </MemoryRouter>
      </RequestsProvider>,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run src/components/ItemCard.test.tsx`
Expected: FAIL — no `img` element is rendered by the current `ItemCard`.

- [ ] **Step 3: Implement the change in `ItemCard.tsx`**

Replace this block:

```tsx
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-card">
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {t.categories[item.category]}
        </span>
      </div>
```

with:

```tsx
      <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-secondary to-card">
        {item.photo_url && (
          <img
            src={item.photo_url}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
        <span className="absolute left-two top-two rounded-full bg-foreground/75 px-two py-half text-xs font-semibold capitalize text-card">
          {t.categories[item.category]}
        </span>
      </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/ItemCard.test.tsx`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Run the full web test suite to check for regressions**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ItemCard.tsx apps/web/src/components/ItemCard.test.tsx
git commit -m "feat(web): render item photo_url on ItemCard"
```

---

## After all tasks

Run the full suite once more (`cd apps/web && npx vitest run`) and `npx tsc --noEmit` (or the project's existing typecheck script, if one exists in `apps/web/package.json`) to confirm no type errors, before moving to PR per `[[workflow_pr_merge_ownership]]` — open the PR against `develop`, do not merge it yourself.
