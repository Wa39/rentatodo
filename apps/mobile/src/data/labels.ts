import { ApiRequestError } from '@/data/api/http';
import type { Category, DepositStatus, ReservationStatus } from '@/data/types';

/**
 * Single place where the frozen contract's enums (English) are
 * mapped to Spanish UI labels and interface colors.
 */
export const STATUS_META: Record<
  ReservationStatus,
  { label: string; color: string; bg: string; active: boolean }
> = {
  // Badge colors from the reference dashboard design:
  // requested=amber, approved=green, delivered=blue.
  requested: { label: 'Solicitada', color: '#8F550F', bg: '#F9ECD6', active: true },
  approved: { label: 'Aprobada', color: '#155C3B', bg: '#E2F0E7', active: true },
  delivered: { label: 'Entregada', color: '#33608F', bg: '#E3EAF3', active: true },
  returned: { label: 'Devuelta', color: '#1E7A4F', bg: '#DFF0E6', active: true },
  closed: { label: 'Cerrada', color: '#5B655E', bg: '#ECEEEA', active: false },
  rejected: { label: 'Rechazada', color: '#C24A32', bg: '#F7E1DA', active: false },
  cancelled: { label: 'Cancelada', color: '#5B655E', bg: '#ECEEEA', active: false },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  tools: 'Herramientas',
  photography: 'Fotografía',
  camping: 'Camping',
  sports: 'Deportes',
  electronics: 'Electrónica',
  home: 'Hogar',
  other: 'Otros',
};

/** Spanish UI messages for the contract's stable error codes. */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Correo o contraseña incorrectos.',
  TOKEN_EXPIRED: 'La sesión expiró. Inicie sesión de nuevo.',
  VALIDATION_ERROR: 'Revise los datos ingresados.',
  NOT_FOUND: 'No se encontró el recurso solicitado.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor.',
  DATES_UNAVAILABLE: 'Las fechas seleccionadas ya no están disponibles.',
  DUPLICATE_RESERVATION: 'Ya existe una solicitud idéntica pendiente.',
  CANNOT_RENT_OWN_ITEM: 'No se puede alquilar un artículo propio.',
  INVALID_TRANSITION: 'La reserva ya no permite esta acción.',
};

/** Spanish labels for the contract's deposit_status. */
export const DEPOSIT_LABELS: Record<DepositStatus, string> = {
  none: 'Sin retención',
  held: 'Retenido',
  released: 'Liberado',
  frozen: 'Congelado (en disputa)',
};

/** Human-readable Spanish message for any error thrown by the data layer. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) {
    return ERROR_MESSAGES[e.code] ?? e.message;
  }
  return 'Algo salió mal. Intente de nuevo.';
}
