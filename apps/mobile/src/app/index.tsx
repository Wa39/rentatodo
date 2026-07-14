import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArticuloCard } from '@/components/articulo-card';
import { ReservaItem } from '@/components/reserva-item';
import { Brand } from '@/constants/brand';
import { fuenteDatos } from '@/data/fuente-datos';
import type { Item, Reservation } from '@/data/types';

type Orden = 'popular' | 'recent';

/**
 * Pantalla de Inicio — según el mockup aprobado (docs/mock_flujo_arrendatario.html):
 * búsqueda, interruptor Populares/Recientes y "Mis solicitudes".
 * NO existe sección "Cerca de mí" ni búsqueda por zona (fuera de alcance).
 */
export default function Inicio() {
  const [orden, setOrden] = useState<Orden>('popular');
  const [texto, setTexto] = useState('');
  const [articulos, setArticulos] = useState<Item[]>([]);
  const [reservas, setReservas] = useState<Reservation[]>([]);

  useEffect(() => {
    if (texto.trim() === '') {
      fuenteDatos.listarArticulos(orden).then(setArticulos);
    } else {
      fuenteDatos.buscarArticulos(texto).then(setArticulos);
    }
  }, [orden, texto]);

  useEffect(() => {
    fuenteDatos.listarReservas().then((r) => setReservas(r.slice(0, 3)));
  }, []);

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <FlatList
        data={reservas}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={styles.lateral}>
            <ReservaItem reserva={item} />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.contenido}>
            <Text style={styles.titulo}>RentaTodo</Text>

            <TextInput
              style={styles.buscador}
              placeholder="Buscar artículos…"
              placeholderTextColor={Brand.muted}
              value={texto}
              onChangeText={setTexto}
            />

            <View style={styles.seg}>
              {(['popular', 'recent'] as const).map((o) => (
                <Pressable
                  key={o}
                  onPress={() => setOrden(o)}
                  style={[styles.segBoton, orden === o && styles.segActivo]}>
                  <Text style={[styles.segTexto, orden === o && styles.segTextoActivo]}>
                    {o === 'popular' ? 'Populares' : 'Publicados recientemente'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <FlatList
              horizontal
              data={articulos}
              keyExtractor={(a) => a.id}
              renderItem={({ item }) => <ArticuloCard articulo={item} />}
              showsHorizontalScrollIndicator={false}
              style={styles.carrusel}
              ListEmptyComponent={<Text style={styles.vacio}>Sin resultados para “{texto}”.</Text>}
            />

            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>Mis solicitudes</Text>
              <Text style={styles.seccionLink}>Ver todas</Text>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: Brand.paper },
  contenido: { padding: 16, paddingBottom: 0 },
  lateral: { paddingHorizontal: 16 },
  titulo: { fontSize: 20, fontWeight: '800', color: Brand.ink, marginBottom: 12 },
  buscador: {
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
  segBoton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segActivo: { backgroundColor: Brand.teal },
  segTexto: { fontSize: 12, fontWeight: '600', color: Brand.muted },
  segTextoActivo: { color: '#fff' },
  carrusel: { marginTop: 12 },
  vacio: { fontSize: 13, color: Brand.muted, paddingVertical: 20 },
  seccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 20,
    marginBottom: 10,
  },
  seccionTitulo: { fontSize: 15, fontWeight: '700', color: Brand.ink },
  seccionLink: { fontSize: 12, fontWeight: '600', color: Brand.teal },
});
