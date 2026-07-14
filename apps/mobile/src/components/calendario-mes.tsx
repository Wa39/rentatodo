import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

// Encabezado de semana al estilo costarricense: K = martes, M = miércoles.
const DIAS_SEMANA = ['L', 'K', 'M', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type Props = {
  anio: number;
  mes: number; // 1-12
  ocupadas: Set<string>; // fechas ISO yyyy-mm-dd no disponibles
};

function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Calendario de solo lectura: pinta las fechas ocupadas que entrega el motor
 * de disponibilidad (mock por ahora). La selección de rango para solicitar
 * llega con el flujo de solicitud (semana 2, tras el contrato congelado).
 */
export function CalendarioMes({ anio, mes, ocupadas }: Props) {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  // Desplazamiento para que la semana empiece en lunes.
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;

  const celdas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <View style={styles.cal}>
      <Text style={styles.titulo}>
        {MESES[mes - 1]} {anio}
      </Text>
      <View style={styles.fila}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={styles.dow}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: celdas.length / 7 }, (_, s) => (
        <View key={s} style={styles.fila}>
          {celdas.slice(s * 7, s * 7 + 7).map((dia, i) => {
            const noDisponible = dia !== null && ocupadas.has(iso(anio, mes, dia));
            return (
              <View key={i} style={[styles.dia, noDisponible && styles.ocupado]}>
                <Text style={[styles.diaTexto, noDisponible && styles.ocupadoTexto]}>
                  {dia ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.leyenda}>
        <View style={[styles.punto, { backgroundColor: Brand.line }]} />
        <Text style={styles.leyendaTexto}>Ocupada (según el motor de disponibilidad)</Text>
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
  titulo: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  fila: { flexDirection: 'row' },
  dow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Brand.muted,
    paddingVertical: 2,
  },
  dia: {
    flex: 1,
    aspectRatio: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 1,
  },
  diaTexto: { fontSize: 11, fontWeight: '600', color: Brand.ink },
  ocupado: { backgroundColor: '#EFF2F4' },
  ocupadoTexto: { color: '#B9C2C9', textDecorationLine: 'line-through' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  punto: { width: 10, height: 10, borderRadius: 3 },
  leyendaTexto: { fontSize: 10.5, color: Brand.muted },
});
