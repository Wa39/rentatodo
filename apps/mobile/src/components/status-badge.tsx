import { StyleSheet, Text, View } from 'react-native';

import { STATUS_META } from '@/data/labels';
import type { ReservationStatus } from '@/data/types';

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
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
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
});
