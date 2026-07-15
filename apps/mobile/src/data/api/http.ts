import type { ApiError, ApiErrorCode } from '@/data/types';

/**
 * Minimal HTTP client for the RentaTodo API (frozen contract).
 * The base URL comes from EXPO_PUBLIC_API_URL; when it is not set the
 * app runs in mock/demo mode and this module is never called.
 */

/** Thrown for any non-2xx response (or when the server is unreachable). */
export class ApiRequestError extends Error {
  /** HTTP status; 0 when the request never reached the server. */
  readonly status: number;
  /** Contract error code, or NETWORK_ERROR when there is no contract body. */
  readonly code: ApiErrorCode | 'NETWORK_ERROR';

  constructor(status: number, code: ApiErrorCode | 'NETWORK_ERROR', message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export function getApiUrl(): string | undefined {
  return process.env.EXPO_PUBLIC_API_URL;
}

let accessToken: string | null = null;

/** Set by the session layer; sent as "Authorization: Bearer" on every request. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl();
  if (!base) {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'EXPO_PUBLIC_API_URL is not set (mock mode)');
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  if (!response.ok) {
    let code: ApiErrorCode | 'NETWORK_ERROR' = 'NETWORK_ERROR';
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as ApiError;
      code = body.error.code;
      message = body.error.message;
    } catch {
      // Body did not follow the contract's Error schema; keep the defaults.
    }
    throw new ApiRequestError(response.status, code, message);
  }

  return (await response.json()) as T;
}
