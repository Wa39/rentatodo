import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBadge } from '@/components/status-badge';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { DEPOSIT_LABELS, STATUS_META, TRANSACTION_META, errorMessage } from '@/data/labels';
import { formatUSD, type Reservation, type Transaction } from '@/data/types';
import { usePolling } from '@/hooks/use-polling';
import {
  countDaysInclusive,
  formatDate,
  formatDateMedium,
  formatDateRange,
  pluralizeDays,
} from '@/utils/dates';

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePolling(
    useCallback(() => {
      if (!id) return;
      dataSource.listReservations().then((all) => setReservation(all.find((r) => r.id === id)));
      // The deposit audit trail can change on the owner's side (release on
      // close) or ours (freeze on report), so refresh it on the same tick.
      dataSource.listTransactions(id).then(setTransactions).catch(() => setTransactions([]));
    }, [id]),
  );

  if (!reservation) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text style={styles.empty}>Reservation not found.</Text>
      </SafeAreaView>
    );
  }

  const days = countDaysInclusive(reservation.start_date, reservation.end_date);
  const cancellable = reservation.status === 'requested' || reservation.status === 'approved';
  // The single photo-evidence action depends on status: check-in from approved,
  // check-out from delivered. Distinct testIDs are kept for the Maestro flows.
  const checkAction =
    reservation.status === 'approved'
      ? { mode: 'in' as const, testID: 'reservation-checkin', label: 'I received the item (check-in)' }
      : reservation.status === 'delivered'
        ? { mode: 'out' as const, testID: 'reservation-checkout', label: 'Return the item (check-out)' }
        : null;

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
          <Text testID="reservation-detail-title" style={styles.topBarTitle}>Reservation</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.thumb}>
            <Text style={styles.initial}>{reservation.item_name.charAt(0)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text testID="reservation-item-name" style={styles.name}>{reservation.item_name}</Text>
            <Text style={styles.dates}>
              {formatDateRange(reservation.start_date, reservation.end_date)} ·{' '}
              {pluralizeDays(days)}
            </Text>
          </View>
          <StatusBadge status={reservation.status} />
        </View>

        <View style={styles.card}>
          <View style={styles.rowLine}>
            <Text testID="reservation-label-status" style={styles.label}>Status</Text>
            <Text style={styles.value}>{STATUS_META[reservation.status].label}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text testID="reservation-label-deposit" style={styles.label}>Deposit</Text>
            <Text style={styles.value}>
              {formatUSD(reservation.deposit_amount)} · {DEPOSIT_LABELS[reservation.deposit_status]}
            </Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.label}>Requested</Text>
            <Text style={styles.value}>{formatDate(reservation.created_at)}</Text>
          </View>
          <View style={[styles.rowLine, styles.rowLast]}>
            <Text style={styles.label}>Last updated</Text>
            <Text style={styles.value}>{formatDate(reservation.updated_at)}</Text>
          </View>
        </View>

        {transactions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.historyTitle}>Deposit movements</Text>
            {transactions.map((t, i) => {
              const meta = TRANSACTION_META[t.type];
              return (
                <View
                  key={t.id}
                  style={[styles.txRow, i === transactions.length - 1 && styles.rowLast]}>
                  <Ionicons
                    name={meta.icon as React.ComponentProps<typeof Ionicons>['name']}
                    size={17}
                    color={meta.color}
                  />
                  <View style={styles.txInfo}>
                    <Text style={styles.txLabel}>{meta.label}</Text>
                    <Text style={styles.txDate}>{formatDateMedium(t.created_at)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: meta.color }]}>
                    {formatUSD(t.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Link
          href={{ pathname: '/item/[id]', params: { id: reservation.item_id } }}
          asChild>
          <Pressable testID="reservation-item-link" style={styles.linkRow}>
            <Ionicons name="cube-outline" size={18} color={Brand.primary} />
            <Text style={styles.linkText}>View item</Text>
            <Ionicons name="chevron-forward" size={16} color={Brand.muted} />
          </Pressable>
        </Link>

        {error && <Text style={styles.error}>{error}</Text>}

        {checkAction && (
          <Pressable
            testID={checkAction.testID}
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: '/check/[id]',
                params: { id: reservation.id, mode: checkAction.mode },
              })
            }>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>{checkAction.label}</Text>
          </Pressable>
        )}

        {(reservation.status === 'delivered' || reservation.status === 'returned') &&
          (reservation.deposit_status === 'frozen' ? (
            <View style={styles.frozenNotice}>
              <Ionicons name="snow-outline" size={16} color="#7A2A1D" />
              <Text style={styles.frozenText}>
                Active report: the deposit is frozen until the dispute is resolved.
              </Text>
            </View>
          ) : (
            <Pressable
              testID="reservation-report"
              style={styles.reportButton}
              onPress={() =>
                router.push({ pathname: '/report/[id]', params: { id: reservation.id } })
              }>
              <Ionicons name="alert-circle-outline" size={18} color={Brand.red} />
              <Text style={styles.reportButtonText}>Report a problem</Text>
            </Pressable>
          ))}

        {cancellable && !confirming && (
          <Pressable
            testID="reservation-cancel"
            style={styles.cancelButton}
            onPress={() => setConfirming(true)}>
            <Text style={styles.cancelText}>Cancel reservation</Text>
          </Pressable>
        )}

        {cancellable && confirming && (
          <View testID="reservation-cancel-dialog" style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              Cancel this reservation?
              {reservation.deposit_status === 'held'
                ? ' The held deposit will be released.'
                : ''}{' '}
              This action cannot be undone.
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                testID="reservation-cancel-dismiss"
                style={[styles.confirmButton, styles.confirmNo]}
                disabled={submitting}
                onPress={() => setConfirming(false)}>
                <Text style={styles.confirmNoText}>Back</Text>
              </Pressable>
              <Pressable
                testID="reservation-cancel-confirm"
                style={[styles.confirmButton, styles.confirmYes]}
                disabled={submitting}
                onPress={onCancel}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmYesText}>Yes, cancel</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.note}>
          The status refreshes automatically every 15 seconds while this screen is open.
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
  historyTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Brand.ink,
    paddingTop: 12,
    paddingBottom: 4,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  txInfo: { flex: 1, minWidth: 0 },
  txLabel: { fontSize: 12.5, fontWeight: '700', color: Brand.ink },
  txDate: { fontSize: 11, color: Brand.muted, marginTop: 1 },
  txAmount: { fontSize: 13, fontWeight: '800' },
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
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Brand.red,
    borderRadius: 14,
    padding: 13,
    marginTop: 14,
  },
  reportButtonText: { color: Brand.red, fontSize: 13.5, fontWeight: '800' },
  frozenNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F7E0DB',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  frozenText: { flex: 1, fontSize: 12, color: '#7A2A1D', lineHeight: 17 },
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
