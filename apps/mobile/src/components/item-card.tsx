import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { CATEGORY_LABELS } from '@/data/labels';
import { formatUSD, type Item } from '@/data/types';

/**
 * Item card for the listings.
 * The real photo arrives as photo_url from Wa's image service;
 * until seeds with photos exist, a placeholder with the initial is shown.
 */
export function ItemCard({ item }: { item: Item }) {
  return (
    <Link href={{ pathname: '/item/[id]', params: { id: item.id } }} asChild>
      <Pressable style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.initial}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.price}>{formatUSD(item.price_per_day)} / día</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {CATEGORY_LABELS[item.category]}
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
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 30,
    fontWeight: '800',
    color: Brand.primary,
    opacity: 0.55,
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
    lineHeight: 17,
  },
  price: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.primary,
    marginTop: 3,
  },
  meta: {
    fontSize: 11,
    color: Brand.muted,
    marginTop: 2,
  },
});
