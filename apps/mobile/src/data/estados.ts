import type { Category, ReservationStatus } from '@/data/types';

/**
 * Único lugar donde se mapean los enums del contrato (en inglés, según el
 * borrador del PR #2) a etiquetas en español y colores de la interfaz.
 */
export const ESTADOS: Record<
  ReservationStatus,
  { etiqueta: string; color: string; fondo: string; activa: boolean }
> = {
  requested: { etiqueta: 'Solicitada', color: '#C97A15', fondo: '#FBECD6', activa: true },
  approved: { etiqueta: 'Aprobada', color: '#2E7D4F', fondo: '#DCEFE2', activa: true },
  delivered: { etiqueta: 'Entregada', color: '#2166A8', fondo: '#DCEAF7', activa: true },
  returned: { etiqueta: 'Devuelta', color: '#0E7C7B', fondo: '#DDEEED', activa: true },
  closed: { etiqueta: 'Cerrada', color: '#5E6B75', fondo: '#E7EBEE', activa: false },
  rejected: { etiqueta: 'Rechazada', color: '#B3402E', fondo: '#F7E0DB', activa: false },
  cancelled: { etiqueta: 'Cancelada', color: '#5E6B75', fondo: '#E7EBEE', activa: false },
};

export const CATEGORIAS: Record<Category, string> = {
  tools: 'Herramientas',
  photography: 'Fotografía',
  camping: 'Camping',
  sports: 'Deportes',
  electronics: 'Electrónica',
  home: 'Hogar',
};
