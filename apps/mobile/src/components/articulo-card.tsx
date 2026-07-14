import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { CATEGORIAS } from '@/data/estados';
import { formatoUSD, type Item } from '@/data/types';

/**
 * Tarjeta de artículo para los listados.
 * La foto real llega como photo_url del servicio de imágenes de Wa;
 * mientras no haya seeds con fotos se muestra un marcador con la inicial.
 */
export function ArticuloCard({ articulo }: { articulo: Item }) {
  return (
    <Link href={{ pathname: '/articulo/[id]', params: { id: articulo.id } }} asChild>
      <Pressable style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.inicial}>{articulo.name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.nombre} numberOfLines={2}>
            {articulo.name}
          </Text>
          <Text style={styles.precio}>{formatoUSD(articulo.price_per_day)} / día</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {CATEGORIAS[articulo.category]}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 12,
  },
  thumb: {
    height: 90,
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inicial: {
    fontSize: 30,
    fontWeight: '800',
    color: Brand.teal,
    opacity: 0.55,
  },
  info: {
    padding: 10,
  },
  nombre: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
    lineHeight: 17,
  },
  precio: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.teal,
    marginTop: 3,
  },
  meta: {
    fontSize: 11,
    color: Brand.muted,
    marginTop: 2,
  },
});
