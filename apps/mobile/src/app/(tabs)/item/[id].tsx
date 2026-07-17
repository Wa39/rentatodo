import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthCalendar } from '@/components/month-calendar';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { CATEGORY_LABELS, errorMessage } from '@/data/labels';
import { formatUSD, type ItemDetail } from '@/data/types';
import { countDaysInclusive, expandRanges, rangeHasUnavailable, todayIso } from '@/utils/dates';

/**
 * Item detail + reservation request (POST /items/{item_id}/reservations).
 * Range selection: first tap sets the start, second tap the end; a tap on
 * the same day requests a single-day rental. Deposit = price_per_day ×
 * days, both dates inclusive (backend-calculated; shown here as preview).
 * No item editing here: that belongs to the owner web (Silverk).
 */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetail | undefined>();

  const today = todayIso();
  const [calYear, setCalYear] = useState(Number(today.slice(0, 4)));
  const [calMonth, setCalMonth] = useState(Number(today.slice(5, 7)));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  const days = start && end ? countDaysInclusive(start, end) : 0;
  const deposit = days * item.price_per_day;

  function onNavigateMonth(delta: number) {
    const next = new Date(calYear, calMonth - 1 + delta, 1);
    setCalYear(next.getFullYear());
    setCalMonth(next.getMonth() + 1);
  }

  function onSelectDay(day: string) {
    setError(null);
    // No selection yet, or a complete range: start over from this day.
    if (!start || end) {
      setStart(day);
      setEnd(null);
      return;
    }
    // Tapping before the start moves the start.
    if (day < start) {
      setStart(day);
      return;
    }
    // Closing the range: reject it if it crosses an occupied day.
    if (rangeHasUnavailable(start, day, unavailable)) {
      setError('El rango elegido incluye días ocupados. Seleccione fechas continuas libres.');
      return;
    }
    setEnd(day);
  }

  async function onSubmit() {
    if (!item || !start || !end) return;
    setError(null);
    setSubmitting(true);
    try {
      await dataSource.createReservation(item.id, start, end);
      // The new request appears in "Mis rentas" with status "Solicitada".
      router.replace('/rentals');
    } catch (e) {
      setError(errorMessage(e));
      // Availability may have changed underneath: repaint with fresh data.
      const fresh = await dataSource.getItem(item.id);
      if (fresh) setItem(fresh);
      setStart(null);
      setEnd(null);
    } finally {
      setSubmitting(false);
    }
  }

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
          <MonthCalendar
            year={calYear}
            month={calMonth}
            unavailable={unavailable}
            minDate={today}
            selectedStart={start}
            selectedEnd={end}
            onSelectDay={onSelectDay}
            onNavigateMonth={onNavigateMonth}
          />
          <Text style={styles.hint}>
            {!start
              ? 'Toque el primer día del alquiler.'
              : !end
                ? 'Ahora toque el último día (o el mismo para un solo día).'
                : 'Fechas listas. Revise el resumen y envíe la solicitud.'}
          </Text>
        </View>

        {start && end && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fechas</Text>
              <Text style={styles.summaryValue}>
                {start} → {end}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duración</Text>
              <Text style={styles.summaryValue}>
                {days} {days === 1 ? 'día' : 'días'} × {formatUSD(item.price_per_day)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryLabelStrong}>Depósito (retenido)</Text>
              <Text style={styles.summaryValueStrong}>{formatUSD(deposit)}</Text>
            </View>
            <Text style={styles.summaryNote}>
              Pago simulado: el depósito se retiene al aprobarse y se libera al cerrar sin
              reportes. Sin cargos reales.
            </Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.cta, (!start || !end || submitting) && styles.ctaDisabled]}
          disabled={!start || !end || submitting}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Solicitar alquiler</Text>
          )}
        </Pressable>
        <Text style={styles.ctaNote}>
          La solicitud queda en estado “Solicitada” hasta que la persona propietaria la apruebe.
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
  hint: { fontSize: 11.5, color: Brand.muted, textAlign: 'center', marginTop: 8 },
  summary: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Brand.line, paddingTop: 8 },
  summaryLabel: { fontSize: 12.5, color: Brand.muted },
  summaryValue: { fontSize: 12.5, fontWeight: '700', color: Brand.ink },
  summaryLabelStrong: { fontSize: 13, fontWeight: '800', color: Brand.ink },
  summaryValueStrong: { fontSize: 14, fontWeight: '800', color: Brand.teal },
  summaryNote: { fontSize: 10.5, color: Brand.muted, lineHeight: 15 },
  error: { color: Brand.red, fontSize: 12, marginTop: 12, textAlign: 'center' },
  cta: {
    backgroundColor: Brand.teal,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ctaNote: { fontSize: 11, color: Brand.muted, textAlign: 'center', marginTop: 8 },
  empty: { fontSize: 13, color: Brand.muted, padding: 24, textAlign: 'center' },
});
