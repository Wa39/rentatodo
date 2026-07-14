import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarioMes } from '@/components/calendario-mes';
import { Brand } from '@/constants/brand';
import { CATEGORIAS } from '@/data/estados';
import { fuenteDatos } from '@/data/fuente-datos';
import { formatoUSD, type ItemDetail, type UnavailableRange } from '@/data/types';

/**
 * Expande los rangos unavailable_dates del contrato a un Set de fechas ISO,
 * que es lo que el calendario pinta día por día.
 */
function expandirRangos(rangos: UnavailableRange[]): Set<string> {
  const fechas = new Set<string>();
  for (const r of rangos) {
    const fin = new Date(r.end_date + 'T00:00:00');
    for (let d = new Date(r.start_date + 'T00:00:00'); d <= fin; d.setDate(d.getDate() + 1)) {
      fechas.add(d.toISOString().slice(0, 10));
    }
  }
  return fechas;
}

/**
 * Detalle del artículo con calendario de disponibilidad (mock con la forma
 * del contrato). El flujo de solicitud + depósito se implementa cuando el
 * contrato quede aprobado. Sin edición del artículo: eso es de la web (Silverk).
 */
export default function DetalleArticulo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [articulo, setArticulo] = useState<ItemDetail | undefined>();

  useEffect(() => {
    if (!id) return;
    fuenteDatos.obtenerArticulo(id).then(setArticulo);
  }, [id]);

  if (!articulo) {
    return (
      <SafeAreaView style={styles.pantalla} edges={['top']}>
        <Text style={styles.vacio}>Artículo no encontrado.</Text>
      </SafeAreaView>
    );
  }

  const ocupadas = expandirRangos(articulo.unavailable_dates);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.barra}>
          <Pressable onPress={() => router.back()} style={styles.volver} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Brand.ink} />
          </Pressable>
          <Text style={styles.barraTitulo}>Detalle</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroInicial}>{articulo.name.charAt(0)}</Text>
        </View>

        <Text style={styles.nombre}>{articulo.name}</Text>
        <Text style={styles.precio}>
          {formatoUSD(articulo.price_per_day)} <Text style={styles.porDia}>/ día</Text>
        </Text>
        <Text style={styles.descripcion}>{articulo.description}</Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipTexto}>{CATEGORIAS[articulo.category]}</Text>
          </View>
        </View>

        <View style={styles.owner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>{articulo.owner_name.charAt(0)}</Text>
          </View>
          <Text style={styles.ownerNombre}>Publicado por {articulo.owner_name}</Text>
        </View>

        <View style={styles.calendario}>
          <CalendarioMes anio={2026} mes={7} ocupadas={ocupadas} />
        </View>

        <Pressable
          style={styles.cta}
          onPress={() =>
            Alert.alert(
              'Flujo pendiente',
              'La solicitud de alquiler y el depósito (simulado) se implementan cuando el contrato OpenAPI quede aprobado y congelado.',
            )
          }>
          <Text style={styles.ctaTexto}>Solicitar alquiler</Text>
        </Pressable>
        <Text style={styles.notaCta}>
          Marcador del flujo de la semana 2 — POST /items/{'{id}'}/reservations según el contrato.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: Brand.paper },
  contenido: { padding: 16 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  volver: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barraTitulo: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  hero: {
    height: 170,
    borderRadius: 16,
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInicial: { fontSize: 56, fontWeight: '800', color: Brand.teal, opacity: 0.45 },
  nombre: { fontSize: 18, fontWeight: '800', color: Brand.ink, marginTop: 14 },
  precio: { fontSize: 15, fontWeight: '800', color: Brand.teal, marginTop: 2 },
  porDia: { fontSize: 11.5, fontWeight: '600', color: Brand.muted },
  descripcion: { fontSize: 12.5, color: Brand.muted, marginTop: 6, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Brand.tealSoft,
  },
  chipTexto: { fontSize: 11, fontWeight: '700', color: Brand.teal },
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
  avatarTexto: { fontSize: 13, fontWeight: '800', color: Brand.teal },
  ownerNombre: { fontSize: 12.5, fontWeight: '700', color: Brand.ink },
  calendario: { marginTop: 12 },
  cta: {
    backgroundColor: Brand.teal,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  ctaTexto: { color: '#fff', fontSize: 14, fontWeight: '800' },
  notaCta: { fontSize: 11, color: Brand.muted, textAlign: 'center', marginTop: 8 },
  vacio: { fontSize: 13, color: Brand.muted, padding: 24, textAlign: 'center' },
});
