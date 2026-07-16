/**
 * Types aligned to the frozen contract: packages/contracts/openapi.yaml
 * (merged to develop via PR #2). Any contract change requires an approved
 * PR from all consumers, so these types only change alongside the spec.
 */

export type Category =
  | 'tools'
  | 'photography'
  | 'camping'
  | 'sports'
  | 'electronics'
  | 'home'
  | 'other';

export type Item = {
  id: string;
  name: string;
  description: string;
  category: Category;
  /** USD cents: 5000 = $50.00. The frontend divides by 100. */
  price_per_day: number;
  photo_url: string;
  is_active: boolean;
  owner_id: string;
  owner_name: string;
  created_at: string;
};

/** Range of already-reserved dates (contract format: ranges, not single dates). */
export type UnavailableRange = {
  start_date: string; // date yyyy-mm-dd
  end_date: string;
};

export type ItemDetail = Item & {
  unavailable_dates: UnavailableRange[];
};

export type ReservationStatus =
  | 'requested'
  | 'approved'
  | 'delivered'
  | 'returned'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export type DepositStatus = 'none' | 'held' | 'released' | 'frozen';

export type Reservation = {
  id: string;
  item_id: string;
  item_name: string;
  item_photo_url: string;
  renter_id: string;
  renter_name: string;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  /** USD cents. Backend-calculated: price_per_day × number of days. */
  deposit_amount: number;
  deposit_status: DepositStatus;
  created_at: string;
  updated_at: string;
};

/** Public user profile (contract UserResponse — no zone, no password). */
export type User = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

/** Response of POST /auth/login. */
export type LoginResponse = {
  access_token: string;
  token_type: string;
  /** Seconds. Contract value: 86400 (24h, no refresh). */
  expires_in: number;
};

/** Formats USD cents as "$50.00". */
export function formatUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Stable error codes — agreed with Trucy on 2026-07-14 and part of the
 * frozen contract. The app decides by `code`, never by the message text.
 *
 * HTTP → codes: 401 UNAUTHORIZED|TOKEN_EXPIRED · 403 FORBIDDEN|CANNOT_RENT_OWN_ITEM
 * 404 NOT_FOUND · 409 DATES_UNAVAILABLE|INVALID_TRANSITION|DUPLICATE_RESERVATION|
 * FREEZE_ACTIVE|REPORT_EXISTS · 422 VALIDATION_ERROR
 */
export type ApiErrorCode =
  | 'CANNOT_RENT_OWN_ITEM'
  | 'DATES_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_RESERVATION'
  | 'REPORT_EXISTS'
  | 'FREEZE_ACTIVE'
  | 'VALIDATION_ERROR';

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

/**
 * Other decisions closed with Trucy (2026-07-14):
 * - Token: 24h, no refresh (expires_in: 86400).
 * - Duplicate request: same renter+item+dates in `requested` → 409 DUPLICATE_RESERVATION (no extra header).
 * - `category`: SINGLE selection. `min_price`/`max_price`: inclusive, either can be sent alone.
 * - Polling: every 15s while the screen is open.
 */
