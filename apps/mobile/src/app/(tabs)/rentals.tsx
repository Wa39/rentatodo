import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReservationRow } from '@/components/reservation-row';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { STATUS_META } from '@/data/labels';
import type { Reservation } from '@/data/types';
import { usePolling } from '@/hooks/use-polling';

type Tab = 'active' | 'past';

/**
 * My rentals — NOT a shopping cart: each reservation is independent, with
 * its own owner, dates and status. History lives in the "Pasadas" tab
 * (design decision: no separate history button). Status changes arrive
 * via 15s polling while the screen is focused (no push, by design).
 */
export default function MyRentalsScreen() {
  const [tab, setTab] = useState<Tab>('active');
  const [reservations, setReservations] = useState<Reservation[]>([]);

  usePolling(
    useCallback(() => {
      dataSource.listReservations().then(setReservations);
    }, []),
  );

  const visible = reservations.filter((r) => STATUS_META[r.status].active === (tab === 'active'));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Mis rentas</Text>
        <View style={styles.tabs}>
          {(['active', 'past'] as const).map((t) => (
            <Pressable key={t} testID={`rentals-tab-${t}`} onPress={() => setTab(t)} style={styles.tab}>
              <Text style={[styles.tabText, tab === t && styles.tabActive]}>
                {t === 'active' ? 'Activas' : 'Pasadas'}
              </Text>
              {tab === t && <View style={styles.tabLine} />}
            </Pressable>
          ))}
        </View>
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReservationRow reservation={item} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No hay rentas {tab === 'active' ? 'activas' : 'pasadas'}.
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Brand.ink, marginBottom: 8 },
  tabs: {
    flexDirection: 'row',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
    marginBottom: 12,
  },
  tab: { paddingVertical: 8 },
  tabText: { fontSize: 14, fontWeight: '700', color: Brand.muted },
  tabActive: { color: Brand.primary },
  tabLine: { height: 2.5, backgroundColor: Brand.primary, borderRadius: 2, marginTop: 6 },
  empty: { fontSize: 13, color: Brand.muted, paddingVertical: 24, textAlign: 'center' },
});
