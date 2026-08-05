import { ApiRequestError } from '@/data/api/http';
import type { Category, DepositStatus, ReservationStatus, TransactionType } from '@/data/types';

/**
 * Single place where the frozen contract's enums (English) are
 * mapped to UI labels and interface colors.
 */
export const STATUS_META: Record<
  ReservationStatus,
  { label: string; color: string; bg: string; active: boolean }
> = {
  // Badge colors from the reference dashboard design:
  // requested=amber, approved=green, delivered=blue.
  requested: { label: 'Requested', color: '#8F550F', bg: '#F9ECD6', active: true },
  approved: { label: 'Approved', color: '#155C3B', bg: '#E2F0E7', active: true },
  delivered: { label: 'Delivered', color: '#33608F', bg: '#E3EAF3', active: true },
  returned: { label: 'Returned', color: '#1E7A4F', bg: '#DFF0E6', active: true },
  closed: { label: 'Closed', color: '#5B655E', bg: '#ECEEEA', active: false },
  rejected: { label: 'Rejected', color: '#C24A32', bg: '#F7E1DA', active: false },
  cancelled: { label: 'Cancelled', color: '#5B655E', bg: '#ECEEEA', active: false },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  tools: 'Tools',
  photography: 'Photography',
  camping: 'Camping',
  sports: 'Sports',
  electronics: 'Electronics',
  home: 'Home',
  other: 'Other',
};

/** UI messages for the contract's stable error codes. */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Incorrect email or password.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  VALIDATION_ERROR: 'Please check the information entered.',
  NOT_FOUND: 'The requested resource was not found.',
  NETWORK_ERROR: 'Could not connect to the server.',
  DATES_UNAVAILABLE: 'The selected dates are no longer available.',
  DUPLICATE_RESERVATION: 'An identical pending request already exists.',
  CANNOT_RENT_OWN_ITEM: 'You cannot rent your own item.',
  INVALID_TRANSITION: 'This action is no longer allowed for this reservation.',
  REPORT_EXISTS: 'This reservation already has an active report.',
  FORBIDDEN: 'You do not have permission for this action.',
};

/** Labels for the contract's deposit_status. */
export const DEPOSIT_LABELS: Record<DepositStatus, string> = {
  none: 'No hold',
  held: 'Held',
  released: 'Released',
  frozen: 'Frozen (in dispute)',
};

/**
 * Labels + icon/color for the contract's transaction types, describing the
 * deposit movement from the renter's point of view: a hold ties funds up,
 * a release returns them, a freeze locks them.
 */
export const TRANSACTION_META: Record<
  TransactionType,
  { label: string; icon: string; color: string }
> = {
  hold: { label: 'Deposit hold', icon: 'lock-closed-outline', color: '#8F550F' },
  release: { label: 'Deposit release', icon: 'lock-open-outline', color: '#155C3B' },
  freeze: { label: 'Frozen for dispute', icon: 'snow-outline', color: '#C24A32' },
};

/** Human-readable message for any error thrown by the data layer. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) {
    return ERROR_MESSAGES[e.code] ?? e.message;
  }
  return 'Something went wrong. Please try again.';
}
