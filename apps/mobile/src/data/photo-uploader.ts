/**
 * Photo upload for check-in/check-out/report evidence.
 *
 * The contract requires a `photo_url` (uri) in those requests, but HOW the
 * photo gets uploaded is not in the contract yet: Wa's presigned-URL spec
 * (S3 / MiniStack locally) is pending. This interface is the swap point —
 * when the spec lands, a PresignedUrlUploader implements it and nothing
 * else changes.
 */
export interface PhotoUploader {
  /** Uploads the local image and returns the public URL for photo_url. */
  upload(localUri: string): Promise<string>;
}

/**
 * Demo/interim implementation: passes the device-local URI through.
 * Enough for the mock and for exercising the API flow end-to-end locally;
 * NOT valid for production (other users can't see a device-local URI).
 */
class LocalPassthroughUploader implements PhotoUploader {
  async upload(localUri: string): Promise<string> {
    return localUri;
  }
}

export const photoUploader: PhotoUploader = new LocalPassthroughUploader();
