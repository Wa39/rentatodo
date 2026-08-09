import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

import { ApiRequestError, apiFetch, getApiUrl } from '@/data/api/http';

/**
 * Photo upload for check-in/check-out/report evidence.
 *
 * The contract's flow (POST /uploads/presign): ask the API for a short-lived
 * pre-signed S3 PUT URL, upload the file straight to S3 (no server in the
 * middle), then send the returned public_url as the request's `photo_url`.
 */

/** A photo picked on the device, as returned by expo-image-picker. */
export type LocalPhoto = {
  uri: string;
  /** Original filename; the API derives the S3 key from it. */
  fileName?: string | null;
  /** MIME type reported by the picker. */
  mimeType?: string | null;
};

export interface PhotoUploader {
  /** Uploads the photo and returns the public URL to store as photo_url. */
  upload(photo: LocalPhoto): Promise<string>;
}

/** Contract PresignResponse. */
type PresignResponse = {
  upload_url: string;
  public_url: string;
  expires_in: number;
};

/** The only content types the contract's PresignRequest accepts. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXTENSION_TYPES: Record<string, (typeof ALLOWED_TYPES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Resolves the content type: the picker's own value when it is one the
 * contract accepts, otherwise derived from the file extension.
 */
function resolveContentType(photo: LocalPhoto): (typeof ALLOWED_TYPES)[number] {
  const reported = photo.mimeType?.toLowerCase();
  if (reported && (ALLOWED_TYPES as readonly string[]).includes(reported)) {
    return reported as (typeof ALLOWED_TYPES)[number];
  }
  const source = photo.fileName ?? photo.uri;
  const extension = source.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const derived = EXTENSION_TYPES[extension];
  if (derived) return derived;
  throw new ApiRequestError(
    422,
    'VALIDATION_ERROR',
    'Unsupported image format. Use JPG, PNG or WEBP.',
  );
}

/** Falls back to a name with the right extension when the picker gives none. */
function resolveFileName(photo: LocalPhoto, contentType: string): string {
  if (photo.fileName) return photo.fileName;
  const fromUri = photo.uri.split('?')[0].split('/').pop();
  if (fromUri && fromUri.includes('.')) return fromUri;
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  return `photo.${extension}`;
}

class PresignedUrlUploader implements PhotoUploader {
  async upload(photo: LocalPhoto): Promise<string> {
    const contentType = resolveContentType(photo);
    const fileName = resolveFileName(photo, contentType);

    // 1. Ask the API to sign an upload (authenticated; apiFetch adds the token).
    const presign = await apiFetch<PresignResponse>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ filename: fileName, content_type: contentType }),
    });

    // 2. Upload the file straight to S3 with a binary PUT (the presigned URL
    //    carries the auth, so no bearer token here; Content-Type must match
    //    what was signed). Native uses expo-file-system's File.upload, which
    //    reads and PUTs the file natively — reliable in release APKs, unlike
    //    fetch(uri).blob() which fails on Android standalone builds. Web keeps
    //    the fetch/blob path (blob: URIs work in the browser).
    let status: number;
    if (Platform.OS === 'web') {
      // Read the local file as a blob first (its own error, distinct from the
      // network PUT), then PUT it. blob: URIs work in the browser.
      let body: Blob;
      try {
        const read = await fetch(photo.uri);
        if (!read.ok) throw new Error(`local read HTTP ${read.status}`);
        body = await read.blob();
      } catch (e) {
        console.warn('[photo-uploader] could not read the photo', e);
        throw new ApiRequestError(0, 'NETWORK_ERROR', 'Could not read the photo from the device.');
      }
      try {
        const response = await fetch(presign.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body,
        });
        status = response.status;
      } catch (e) {
        console.warn('[photo-uploader] S3 upload failed', e);
        throw new ApiRequestError(0, 'NETWORK_ERROR', 'The photo upload failed. Please try again.');
      }
    } else {
      // Native: File.upload reads and PUTs the file natively — reliable in
      // release APKs, unlike fetch(uri).blob(). mimeType is set alongside the
      // header so the request Content-Type matches what S3 signed (else 403).
      try {
        const result = await new File(photo.uri).upload(presign.upload_url, {
          uploadType: UploadType.BINARY_CONTENT,
          httpMethod: 'PUT',
          mimeType: contentType,
          headers: { 'Content-Type': contentType },
        });
        status = result.status;
      } catch (e) {
        console.warn('[photo-uploader] S3 upload failed', e);
        throw new ApiRequestError(0, 'NETWORK_ERROR', 'The photo upload failed. Please try again.');
      }
    }
    if (status < 200 || status >= 300) {
      // S3 answers with XML, not the contract's Error shape.
      throw new ApiRequestError(status, 'NETWORK_ERROR', 'The photo upload failed. Please try again.');
    }

    return presign.public_url;
  }
}

/**
 * Demo-mode implementation: passes the device-local URI through, so the app
 * stays fully usable without a backend. NOT valid outside the device.
 */
class LocalPassthroughUploader implements PhotoUploader {
  async upload(photo: LocalPhoto): Promise<string> {
    return photo.uri;
  }
}

export const photoUploader: PhotoUploader = getApiUrl()
  ? new PresignedUrlUploader()
  : new LocalPassthroughUploader();
