import { StyleSheet, Text, View } from 'react-native';

import { EstadoBadge } from '@/components/estado-badge';
import { Brand } from '@/constants/brand';
import type { Reservation } from '@/data/types';

function formatearRango(r: Reservation): string {
  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const inicio = new Date(r.start_date + 'T00:00:00').toLocaleDateString('es-CR', opciones);
  const fin = new Date(r.end_date + 'T00:00:00').toLocaleDateString('es-CR', opciones);
  return inicio === fin ? inicio : `${inicio} – ${fin}`;
}

export function ReservaItem({ reserva }: { reserva: Reservation }) {
  return (
    <View style={styles.fila}>
      <View style={styles.thumb}>
        <Text style={styles.inicial}>{reserva.item_name.charAt(0)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={1}>
          {reserva.item_name}
        </Text>
        <Text style={styles.fechas}>{formatearRango(reserva)}</Text>
      </View>
      <EstadoBadge estado={reserva.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.teal,
    opacity: 0.55,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nombre: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
  },
  fechas: {
    fontSize: 11,
    color: Brand.muted,
    marginTop: 2,
  },
});
