import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReservaItem } from '@/components/reserva-item';
import { Brand } from '@/constants/brand';
import { ESTADOS } from '@/data/estados';
import { fuenteDatos } from '@/data/fuente-datos';
import type { Reservation } from '@/data/types';

/**
 * Mis rentas — NO es un carrito: cada reserva es independiente, con su
 * dueño, fechas y estado propios. El historial vive en la pestaña "Pasadas"
 * (decisión de diseño: no hay botón de historial aparte).
 */
export default function MisRentas() {
  const [pestana, setPestana] = useState<'activas' | 'pasadas'>('activas');
  const [reservas, setReservas] = useState<Reservation[]>([]);

  useEffect(() => {
    fuenteDatos.listarReservas().then(setReservas);
  }, []);

  const visibles = reservas.filter((r) => ESTADOS[r.status].activa === (pestana === 'activas'));

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.contenido}>
        <Text style={styles.titulo}>Mis rentas</Text>
        <View style={styles.tabs}>
          {(['activas', 'pasadas'] as const).map((p) => (
            <Pressable key={p} onPress={() => setPestana(p)} style={styles.tab}>
              <Text style={[styles.tabTexto, pestana === p && styles.tabActivo]}>
                {p === 'activas' ? 'Activas' : 'Pasadas'}
              </Text>
              {pestana === p && <View style={styles.tabLinea} />}
            </Pressable>
          ))}
        </View>
        <FlatList
          data={visibles}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReservaItem reserva={item} />}
          ListEmptyComponent={<Text style={styles.vacio}>No hay rentas {pestana}.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: Brand.paper },
  contenido: { flex: 1, padding: 16 },
  titulo: { fontSize: 20, fontWeight: '800', color: Brand.ink, marginBottom: 8 },
  tabs: {
    flexDirection: 'row',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
    marginBottom: 12,
  },
  tab: { paddingVertical: 8 },
  tabTexto: { fontSize: 14, fontWeight: '700', color: Brand.muted },
  tabActivo: { color: Brand.teal },
  tabLinea: { height: 2.5, backgroundColor: Brand.teal, borderRadius: 2, marginTop: 6 },
  vacio: { fontSize: 13, color: Brand.muted, paddingVertical: 24, textAlign: 'center' },
});
