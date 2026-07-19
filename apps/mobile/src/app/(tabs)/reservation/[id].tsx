import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { DEPOSIT_LABELS, STATUS_META, errorMessage } from '@/data/labels';
import { formatUSD, type Reservation } from '@/data/types';
import { usePolling } from '@/hooks/use-polling';
import { countDaysInclusive, formatDateRangeEs } from '@/utils/dates';

/**
 * Reservation detail. The contract has no GET /reservations/{id}, so the
 * data comes from GET /users/me/reservations, refreshed by the same 15s
 * polling as the list (approval/rejection shows up on its own).
 * Cancel: renter-only action, requested|approved → cancelled (contract);
 * confirmation is inline two-step because Alert has no web support.
 */
export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reservation, setReservation] = useState<Reservation | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePolling(
    useCallback(() => {
      if (!id) return;
      dataSource.listReservations().then((all) => setReservation(all.find((r) => r.id === id)));
    }, [id]),
  );

  if (!reservation) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text style={styles.empty}>Reserva no encontrada.</Text>
      </SafeAreaView>
    );
  }

  const days = countDaysInclusive(reservation.start_date, reservation.end_date);
  const cancellable = reservation.status === 'requested' || reservation.status === 'approved';

  async function onCancel() {
    if (!reservation) return;
    setError(null);
    setSubmitting(true);
    try {
      const updated = await dataSource.cancelReservation(reservation.id);
      setReservation(updated);
      setConfirming(false);
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
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
          <Text style={styles.topBarTitle}>Reserva</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.thumb}>
            <Text style={styles.initial}>{reservation.item_name.charAt(0)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{reservation.item_name}</Text>
            <Text style={styles.dates}>
              {formatDateRangeEs(reservation.start_date, reservation.end_date)} · {days}{' '}
              {days === 1 ? 'día' : 'días'}
            </Text>
          </View>
          <StatusBadge status={reservation.status} />
        </View>

        <View style={styles.card}>
          <View style={styles.rowLine}>
            <Text style={styles.label}>Estado</Text>
            <Text style={styles.value}>{STATUS_META[reservation.status].label}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.label}>Depósito</Text>
            <Text style={styles.value}>
              {formatUSD(reservation.deposit_amount)} · {DEPOSIT_LABELS[reservation.deposit_status]}
            </Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.label}>Solicitada</Text>
            <Text style={styles.value}>
              {new Date(reservation.created_at).toLocaleDateString('es-CR')}
            </Text>
          </View>
          <View style={[styles.rowLine, styles.rowLast]}>
            <Text style={styles.label}>Última actualización</Text>
            <Text style={styles.value}>
              {new Date(reservation.updated_at).toLocaleDateString('es-CR')}
            </Text>
          </View>
        </View>

        <Link
          href={{ pathname: '/item/[id]', params: { id: reservation.item_id } }}
          asChild>
          <Pressable style={styles.linkRow}>
            <Ionicons name="cube-outline" size={18} color={Brand.primary} />
            <Text style={styles.linkText}>Ver artículo</Text>
            <Ionicons name="chevron-forward" size={16} color={Brand.muted} />
          </Pressable>
        </Link>

        {error && <Text style={styles.error}>{error}</Text>}

        {reservation.status === 'approved' && (
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push({ pathname: '/check/[id]', params: { id: reservation.id, mode: 'in' } })
            }>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Recibí el artículo (check-in)</Text>
          </Pressable>
        )}

        {reservation.status === 'delivered' && (
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push({ pathname: '/check/[id]', params: { id: reservation.id, mode: 'out' } })
            }>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Devolver el artículo (check-out)</Text>
          </Pressable>
        )}

        {cancellable && !confirming && (
          <Pressable style={styles.cancelButton} onPress={() => setConfirming(true)}>
            <Text style={styles.cancelText}>Cancelar reserva</Text>
          </Pressable>
        )}

        {cancellable && confirming && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              ¿Cancelar esta reserva?
              {reservation.deposit_status === 'held'
                ? ' El depósito retenido se libera.'
                : ''}{' '}
              Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                style={[styles.confirmButton, styles.confirmNo]}
                disabled={submitting}
                onPress={() => setConfirming(false)}>
                <Text style={styles.confirmNoText}>Volver</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmYes]}
                disabled={submitting}
                onPress={onCancel}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmYesText}>Sí, cancelar</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.note}>
          El estado se actualiza automáticamente cada 15 segundos mientras esta pantalla está
          abierta.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    padding: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 20, fontWeight: '800', color: Brand.primary, opacity: 0.55 },
  headerInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: Brand.ink },
  dates: { fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  card: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 12.5, color: Brand.muted },
  value: { fontSize: 12.5, fontWeight: '700', color: Brand.ink },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  linkText: { flex: 1, fontSize: 13, fontWeight: '700', color: Brand.ink },
  error: { color: Brand.red, fontSize: 12, marginTop: 12, textAlign: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  primaryButtonText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  cancelButton: {
    borderWidth: 1.5,
    borderColor: Brand.red,
    borderRadius: 14,
    padding: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  cancelText: { color: Brand.red, fontSize: 13.5, fontWeight: '800' },
  confirmBox: {
    backgroundColor: '#F7E0DB',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  confirmText: { fontSize: 12.5, color: '#7A2A1D', lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  confirmNo: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line },
  confirmNoText: { fontSize: 13, fontWeight: '700', color: Brand.ink },
  confirmYes: { backgroundColor: Brand.red },
  confirmYesText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  note: { fontSize: 10.5, color: Brand.muted, textAlign: 'center', marginTop: 14 },
  empty: { fontSize: 13, color: Brand.muted, padding: 24, textAlign: 'center' },
});
