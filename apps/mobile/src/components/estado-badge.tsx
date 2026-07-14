import { StyleSheet, Text, View } from 'react-native';

import { ESTADOS } from '@/data/estados';
import type { ReservationStatus } from '@/data/types';

export function EstadoBadge({ estado }: { estado: ReservationStatus }) {
  const e = ESTADOS[estado];
  return (
    <View style={[styles.badge, { backgroundColor: e.fondo }]}>
      <Text style={[styles.texto, { color: e.color }]}>{e.etiqueta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  texto: {
    fontSize: 10,
    fontWeight: '700',
  },
});
