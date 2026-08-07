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

/** Abort a request after this long so a hung/unreachable server can't freeze the UI. */
const REQUEST_TIMEOUT_MS = 10_000;

let accessToken: string | null = null;

/** Set by the session layer; sent as "Authorization: Bearer" on every request. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

let onAuthError: (() => void) | null = null;

/**
 * Registered by the session layer. Invoked once when an *authenticated*
 * request is rejected with 401 (expired/invalid token mid-session), so the
 * session can sign out centrally instead of each screen handling expiry.
 * A 401 from an unauthenticated call (e.g. bad login credentials) never
 * triggers it, because no token was attached.
 */
export function setAuthErrorHandler(handler: (() => void) | null): void {
  onAuthError = handler;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl();
  if (!base) {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'EXPO_PUBLIC_API_URL is not set (mock mode)');
  }

  const hadToken = accessToken !== null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      timedOut ? 'The request timed out' : 'Could not reach the server',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // An authenticated request rejected with 401 means the session died
    // (expired/invalid token): sign out centrally, then still throw so the
    // caller's own error handling runs.
    if (response.status === 401 && hadToken) onAuthError?.();

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
