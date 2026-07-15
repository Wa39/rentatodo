import { ApiRequestError } from '@/data/api/http';
import type { Category, ReservationStatus } from '@/data/types';

/**
 * Single place where the frozen contract's enums (English) are
 * mapped to Spanish UI labels and interface colors.
 */
export const STATUS_META: Record<
  ReservationStatus,
  { label: string; color: string; bg: string; active: boolean }
> = {
  requested: { label: 'Solicitada', color: '#C97A15', bg: '#FBECD6', active: true },
  approved: { label: 'Aprobada', color: '#2E7D4F', bg: '#DCEFE2', active: true },
  delivered: { label: 'Entregada', color: '#2166A8', bg: '#DCEAF7', active: true },
  returned: { label: 'Devuelta', color: '#0E7C7B', bg: '#DDEEED', active: true },
  closed: { label: 'Cerrada', color: '#5E6B75', bg: '#E7EBEE', active: false },
  rejected: { label: 'Rechazada', color: '#B3402E', bg: '#F7E0DB', active: false },
  cancelled: { label: 'Cancelada', color: '#5E6B75', bg: '#E7EBEE', active: false },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  tools: 'Herramientas',
  photography: 'Fotografía',
  camping: 'Camping',
  sports: 'Deportes',
  electronics: 'Electrónica',
  home: 'Hogar',
};

/** Spanish UI messages for the contract's stable error codes. */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Correo o contraseña incorrectos.',
  TOKEN_EXPIRED: 'La sesión expiró. Inicie sesión de nuevo.',
  VALIDATION_ERROR: 'Revise los datos ingresados.',
  NOT_FOUND: 'No se encontró el recurso solicitado.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor.',
};

/** Human-readable Spanish message for any error thrown by the data layer. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) {
    return ERROR_MESSAGES[e.code] ?? e.message;
  }
  return 'Algo salió mal. Intente de nuevo.';
}
