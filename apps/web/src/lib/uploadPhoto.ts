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
