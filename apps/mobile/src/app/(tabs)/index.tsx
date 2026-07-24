import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemCard } from '@/components/item-card';
import { ReservationRow } from '@/components/reservation-row';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import type { Item, Reservation } from '@/data/types';

type Sort = 'popular' | 'recent';

/**
 * Home screen — per the approved mockup (docs/mock_flujo_arrendatario.html):
 * search, Popular/Recent toggle and "Mis solicitudes".
 * There is NO "near me" section nor zone search (out of scope).
 */
export default function HomeScreen() {
  const [sort, setSort] = useState<Sort>('popular');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    if (query.trim() === '') {
      dataSource.listItems(sort).then(setItems);
    } else {
      dataSource.searchItems(query).then(setItems);
    }
  }, [sort, query]);

  useEffect(() => {
    dataSource.listReservations().then((r) => setReservations(r.slice(0, 3)));
  }, []);

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
        ListHeaderComponent={
          <View style={styles.content}>
            <Text style={styles.title}>RentaTodo</Text>

            <TextInput
              testID="home-search"
              style={styles.search}
              placeholder="Buscar artículos…"
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
                    {s === 'popular' ? 'Populares' : 'Publicados recientemente'}
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
              ListEmptyComponent={<Text style={styles.empty}>Sin resultados para “{query}”.</Text>}
            />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mis solicitudes</Text>
              <Text style={styles.sectionLink}>Ver todas</Text>
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
  empty: { fontSize: 13, color: Brand.muted, paddingVertical: 20 },
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
