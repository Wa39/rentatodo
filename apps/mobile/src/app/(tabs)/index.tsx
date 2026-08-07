import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemCard } from '@/components/item-card';
import { ListState } from '@/components/list-state';
import { ReservationRow } from '@/components/reservation-row';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { errorMessage } from '@/data/labels';
import type { Item, Reservation } from '@/data/types';

type Sort = 'popular' | 'recent';

/**
 * Home screen — per the agreed renter flow (see docs/search-and-filters.md):
 * search, Popular/Recent toggle and the requests list.
 * There is NO "near me" section nor zone search (out of scope).
 */
export default function HomeScreen() {
  const [sort, setSort] = useState<Sort>('popular');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce the search box so typing a word is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadItems = useCallback(() => {
    const term = debouncedQuery.trim();
    const request = term === '' ? dataSource.listItems(sort) : dataSource.searchItems(term);
    return request
      .then((data) => {
        setItems(data);
        setItemsError(null);
      })
      .catch((e) => setItemsError(errorMessage(e)))
      .finally(() => setItemsLoading(false));
  }, [sort, debouncedQuery]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const loadReservations = useCallback(
    () =>
      dataSource
        .listReservations()
        .then((r) => {
          setReservations(r.slice(0, 3));
          setReservationsError(null);
        })
        // A 401 already signs out via the auth-error handler; for other
        // failures show a message instead of a misleading "no requests yet".
        .catch((e) => setReservationsError(errorMessage(e))),
    [],
  );

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const onRetryItems = useCallback(() => {
    setItemsLoading(true);
    setItemsError(null);
    loadItems();
  }, [loadItems]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadItems(), loadReservations()]).finally(() => setRefreshing(false));
  }, [loadItems, loadReservations]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={reservations}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={styles.side}>
            <ReservationRow reservation={item} />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Brand.primary}
            colors={[Brand.primary]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.sideEmpty}>
            {reservationsError ?? "You don't have any requests yet."}
          </Text>
        }
        ListHeaderComponent={
          <View style={styles.content}>
            <Text testID="home-title" style={styles.title}>RentaTodo</Text>

            <TextInput
              testID="home-search"
              style={styles.search}
              placeholder="Search items…"
              placeholderTextColor={Brand.muted}
              value={query}
              onChangeText={setQuery}
            />

            <View style={styles.seg}>
              {(['popular', 'recent'] as const).map((s) => (
                <Pressable
                  key={s}
                  testID={`home-sort-${s}`}
                  onPress={() => setSort(s)}
                  style={[styles.segButton, sort === s && styles.segActive]}>
                  <Text style={[styles.segText, sort === s && styles.segTextActive]}>
                    {s === 'popular' ? 'Popular' : 'Recently listed'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <FlatList
              horizontal
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <ItemCard item={item} />}
              showsHorizontalScrollIndicator={false}
              style={styles.rail}
              ListEmptyComponent={
                <ListState
                  loading={itemsLoading}
                  error={itemsError}
                  emptyText={
                    query.trim() === '' ? 'No items.' : `No results for “${query}”.`
                  }
                  onRetry={onRetryItems}
                />
              }
            />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My requests</Text>
              <Link href="/rentals" asChild>
                <Pressable hitSlop={8}>
                  <Text testID="home-see-all" style={styles.sectionLink}>
                    See all
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  content: { padding: 16, paddingBottom: 0 },
  side: { paddingHorizontal: 16 },
  sideEmpty: { fontSize: 13, color: Brand.muted, paddingHorizontal: 16, paddingBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: Brand.ink, marginBottom: 12 },
  search: {
    height: 42,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Brand.ink,
  },
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    gap: 2,
  },
  segButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segActive: { backgroundColor: Brand.primary },
  segText: { fontSize: 12, fontWeight: '600', color: Brand.muted },
  segTextActive: { color: '#fff' },
  rail: { marginTop: 12 },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Brand.ink },
  sectionLink: { fontSize: 12, fontWeight: '600', color: Brand.primary },
});
