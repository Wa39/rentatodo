import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';

/**
 * Back button + title bar shared by the detail and flow screens (item,
 * reservation, check-in/out, report). `titleTestID` keeps the Maestro
 * assertions (e.g. reservation-detail-title, check-title, report-title).
 */
export function ScreenHeader({ title, titleTestID }: { title: string; titleTestID?: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={Brand.ink} />
      </Pressable>
      <Text testID={titleTestID} style={styles.topBarTitle}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink, flex: 1 },
});
