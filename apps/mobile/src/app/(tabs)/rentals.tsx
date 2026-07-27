import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListState } from '@/components/list-state';
import { ReservationRow } from '@/components/reservation-row';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { STATUS_META, errorMessage } from '@/data/labels';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Only the first fetch drives the spinner; later background polls must not.
  const loaded = useRef(false);

  const load = useCallback(() => {
    dataSource
      .listReservations()
      .then((r) => {
        setReservations(r);
        setError(null);
      })
      .catch((e) => {
        // A background poll keeps the current list; only an empty screen shows the error.
        if (!loaded.current) setError(errorMessage(e));
      })
      .finally(() => {
        loaded.current = true;
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  usePolling(load);

  const onRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Brand.primary}
              colors={[Brand.primary]}
            />
          }
          ListEmptyComponent={
            <ListState
              loading={loading}
              error={error}
              emptyText={`No hay rentas ${tab === 'active' ? 'activas' : 'pasadas'}.`}
              onRetry={onRetry}
            />
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
});
