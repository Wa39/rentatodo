import type { Category, ReservationStatus } from '@/data/types';

/**
 * Single place where contract enums (English, per the PR #2 draft) are
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
