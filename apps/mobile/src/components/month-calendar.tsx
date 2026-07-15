import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

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
};

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Read-only calendar: paints the unavailable dates provided by the
 * availability engine (mock for now). Range selection for requesting
 * arrives with the reservation flow (week 2, after the contract freeze).
 */
export function MonthCalendar({ year, month, unavailable }: Props) {
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
      <Text style={styles.title}>
        {MONTHS[month - 1]} {year}
      </Text>
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
            const isUnavailable = day !== null && unavailable.has(iso(year, month, day));
            return (
              <View key={i} style={[styles.day, isUnavailable && styles.unavailable]}>
                <Text style={[styles.dayText, isUnavailable && styles.unavailableText]}>
                  {day ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: Brand.line }]} />
        <Text style={styles.legendText}>Ocupada (según el motor de disponibilidad)</Text>
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
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'center',
    marginBottom: 8,
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
  unavailable: { backgroundColor: '#EFF2F4' },
  unavailableText: { color: '#B9C2C9', textDecorationLine: 'line-through' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10.5, color: Brand.muted },
});
