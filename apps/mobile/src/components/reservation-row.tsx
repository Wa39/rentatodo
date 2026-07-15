import { StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/status-badge';
import { Brand } from '@/constants/brand';
import type { Reservation } from '@/data/types';

function formatDateRange(r: Reservation): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const start = new Date(r.start_date + 'T00:00:00').toLocaleDateString('es-CR', options);
  const end = new Date(r.end_date + 'T00:00:00').toLocaleDateString('es-CR', options);
  return start === end ? start : `${start} – ${end}`;
}

export function ReservationRow({ reservation }: { reservation: Reservation }) {
  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        <Text style={styles.initial}>{reservation.item_name.charAt(0)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {reservation.item_name}
        </Text>
        <Text style={styles.dates}>{formatDateRange(reservation)}</Text>
      </View>
      <StatusBadge status={reservation.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
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
  initial: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.teal,
    opacity: 0.55,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
  },
  dates: {
    fontSize: 11,
    color: Brand.muted,
    marginTop: 2,
  },
});
