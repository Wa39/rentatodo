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
