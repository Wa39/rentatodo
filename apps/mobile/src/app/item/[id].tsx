import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthCalendar } from '@/components/month-calendar';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { CATEGORY_LABELS } from '@/data/labels';
import { formatUSD, type ItemDetail, type UnavailableRange } from '@/data/types';

/**
 * Expands the contract's unavailable_dates ranges into a Set of ISO dates,
 * which is what the calendar paints day by day.
 */
function expandRanges(ranges: UnavailableRange[]): Set<string> {
  const dates = new Set<string>();
  for (const r of ranges) {
    const end = new Date(r.end_date + 'T00:00:00');
    for (let d = new Date(r.start_date + 'T00:00:00'); d <= end; d.setDate(d.getDate() + 1)) {
      dates.add(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

/**
 * Item detail with availability calendar (mock shaped like the contract).
 * The request + deposit flow gets implemented once the contract is approved.
 * No item editing here: that belongs to the owner web (Silverk).
 */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetail | undefined>();

  useEffect(() => {
    if (!id) return;
    dataSource.getItem(id).then(setItem);
  }, [id]);

  if (!item) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text style={styles.empty}>Artículo no encontrado.</Text>
      </SafeAreaView>
    );
  }

  const unavailable = expandRanges(item.unavailable_dates);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Brand.ink} />
          </Pressable>
          <Text style={styles.topBarTitle}>Detalle</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroInitial}>{item.name.charAt(0)}</Text>
        </View>

        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>
          {formatUSD(item.price_per_day)} <Text style={styles.perDay}>/ día</Text>
        </Text>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{CATEGORY_LABELS[item.category]}</Text>
          </View>
        </View>

        <View style={styles.owner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.owner_name.charAt(0)}</Text>
          </View>
          <Text style={styles.ownerName}>Publicado por {item.owner_name}</Text>
        </View>

        <View style={styles.calendar}>
          <MonthCalendar year={2026} month={7} unavailable={unavailable} />
        </View>

        <Pressable
          style={styles.cta}
          onPress={() =>
            Alert.alert(
              'Flujo pendiente',
              'La solicitud de alquiler y el depósito (simulado) se implementan cuando el contrato OpenAPI quede aprobado y congelado.',
            )
          }>
          <Text style={styles.ctaText}>Solicitar alquiler</Text>
        </Pressable>
        <Text style={styles.ctaNote}>
          Marcador del flujo de la semana 2 — POST /items/{'{id}'}/reservations según el contrato.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  content: { padding: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  hero: {
    height: 170,
    borderRadius: 16,
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: { fontSize: 56, fontWeight: '800', color: Brand.teal, opacity: 0.45 },
  name: { fontSize: 18, fontWeight: '800', color: Brand.ink, marginTop: 14 },
  price: { fontSize: 15, fontWeight: '800', color: Brand.teal, marginTop: 2 },
  perDay: { fontSize: 11.5, fontWeight: '600', color: Brand.muted },
  description: { fontSize: 12.5, color: Brand.muted, marginTop: 6, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Brand.tealSoft,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: Brand.teal },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    padding: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: Brand.teal },
  ownerName: { fontSize: 12.5, fontWeight: '700', color: Brand.ink },
  calendar: { marginTop: 12 },
  cta: {
    backgroundColor: Brand.teal,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ctaNote: { fontSize: 11, color: Brand.muted, textAlign: 'center', marginTop: 8 },
  empty: { fontSize: 13, color: Brand.muted, padding: 24, textAlign: 'center' },
});
