// Shared fixtures for tests that exercise PhotoUploadField (directly or via
// a page that embeds it) — was independently copy-pasted into
// PhotoUploadField.test.tsx, PublishItemPage.test.tsx, and
// ReservationDetailPage.test.tsx before being extracted here.

export function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

// The first 12 bytes of a real JPEG — enough for uploadPhoto's magic-byte
// signature check (SIGNATURE_CHECKS['image/jpeg'] in lib/uploadPhoto.ts)
// to accept it as valid.
export const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]
