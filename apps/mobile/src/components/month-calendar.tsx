import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { isoDate } from '@/utils/dates';

// Costa Rican-style weekday header: K = martes, M = miércoles.
const WEEKDAYS = ['L', 'K', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type Props = {
  year: number;
  month: number; // 1-12
  unavailable: Set<string>; // ISO yyyy-mm-dd dates that are not available
  /** Days before this ISO date render disabled (contract: start today or future). */
  minDate?: string;
  selectedStart?: string | null;
  selectedEnd?: string | null;
  /** Makes available days pressable; without it the calendar is read-only. */
  onSelectDay?: (day: string) => void;
  /** Renders month navigation arrows; delta is -1 or +1. */
  onNavigateMonth?: (delta: number) => void;
};

/**
 * Availability calendar. Paints the unavailable dates coming from the
 * contract's unavailable_dates ranges and, when onSelectDay is provided,
 * lets the renter pick the start/end of the reservation request.
 */
export function MonthCalendar({
  year,
  month,
  unavailable,
  minDate,
  selectedStart,
  selectedEnd,
  onSelectDay,
  onNavigateMonth,
}: Props) {
  const daysInMonth = new Date(year, month, 0).getDate();
  // Offset so the week starts on Monday.
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.cal}>
      <View style={styles.titleRow}>
        {onNavigateMonth ? (
          <Pressable onPress={() => onNavigateMonth(-1)} hitSlop={8} style={styles.navButton}>
            <Ionicons name="chevron-back" size={16} color={Brand.ink} />
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
        <Text style={styles.title}>
          {MONTHS[month - 1]} {year}
        </Text>
        {onNavigateMonth ? (
          <Pressable onPress={() => onNavigateMonth(1)} hitSlop={8} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={16} color={Brand.ink} />
          </Pressable>
        ) : (
          <View style={styles.navButton} />
        )}
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.dow}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.row}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (day === null) return <View key={i} style={styles.day} />;

            const date = isoDate(year, month, day);
            const isUnavailable = unavailable.has(date);
            const isPast = minDate !== undefined && date < minDate;
            const isEdge = date === selectedStart || date === selectedEnd;
            const isInRange =
              !!selectedStart && !!selectedEnd && date > selectedStart && date < selectedEnd;
            const selectable = !!onSelectDay && !isUnavailable && !isPast;

            return (
              <Pressable
                key={i}
                disabled={!selectable}
                onPress={() => onSelectDay?.(date)}
                style={[
                  styles.day,
                  isUnavailable && styles.unavailable,
                  isInRange && styles.inRange,
                  isEdge && styles.edge,
                ]}>
                <Text
                  style={[
                    styles.dayText,
                    isPast && styles.pastText,
                    isUnavailable && styles.unavailableText,
                    isEdge && styles.edgeText,
                  ]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: Brand.line }]} />
        <Text style={styles.legendText}>Ocupada</Text>
        {onSelectDay && (
          <>
            <View style={[styles.dot, { backgroundColor: Brand.teal }]} />
            <Text style={styles.legendText}>Selección</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cal: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'center',
  },
  row: { flexDirection: 'row' },
  dow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Brand.muted,
    paddingVertical: 2,
  },
  day: {
    flex: 1,
    aspectRatio: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 1,
  },
  dayText: { fontSize: 11, fontWeight: '600', color: Brand.ink },
  pastText: { color: '#C4CCD2' },
  unavailable: { backgroundColor: '#EFF2F4' },
  unavailableText: { color: '#B9C2C9', textDecorationLine: 'line-through' },
  inRange: { backgroundColor: Brand.tealSoft },
  edge: { backgroundColor: Brand.teal },
  edgeText: { color: '#fff', fontWeight: '800' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10.5, color: Brand.muted, marginRight: 6 },
});
