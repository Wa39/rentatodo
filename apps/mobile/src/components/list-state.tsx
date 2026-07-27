import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

/**
 * Shared placeholder for a list's three non-content states: the initial
 * load (spinner), a fetch failure (message + retry) and empty (muted
 * text). Screens render it as their FlatList's ListEmptyComponent so the
 * loading/error/empty handling stays identical everywhere. A background
 * refresh (15s polling or pull-to-refresh) never routes through here — it
 * keeps the current content on screen.
 */
export function ListState({
  loading,
  error,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  emptyText: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={Brand.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.box}>
        <Ionicons name="cloud-offline-outline" size={30} color={Brand.muted} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retry} onPress={onRetry} hitSlop={8}>
          <Ionicons name="refresh" size={15} color={Brand.primary} />
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.emptyText}>{emptyText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: Brand.muted, textAlign: 'center' },
  errorText: { fontSize: 13, color: Brand.muted, textAlign: 'center', paddingHorizontal: 24 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});
