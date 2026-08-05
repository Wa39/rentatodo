import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { useSession } from '@/context/session-context';

/**
 * Profile — per the contract (UserResponse): id, name, email, created_at.
 * The zone concept is out of the contract ("near me" was removed from scope).
 * Payment method is simulated (mock): there are no real payments in this project.
 */
export default function ProfileScreen() {
  const { user, logout } = useSession();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name ?? 'Z').charAt(0).toUpperCase()}</Text>
          </View>
          <Text testID="profile-user-name" style={styles.name}>{user?.name ?? 'Renter'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        <View testID="profile-payment-method" style={styles.item}>
          <Ionicons name="card-outline" size={19} color={Brand.primary} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Payment method</Text>
            <Text style={styles.itemSub}>Simulated (mock) · no real charges</Text>
          </View>
        </View>

        <View testID="profile-settings" style={styles.item}>
          <Ionicons name="settings-outline" size={19} color={Brand.primary} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Settings</Text>
            <Text style={styles.itemSub}>In-app notifications (polling)</Text>
          </View>
        </View>

        <Pressable testID="profile-logout" style={styles.item} onPress={logout}>
          <Ionicons name="log-out-outline" size={19} color={Brand.red} />
          <View style={styles.itemInfo}>
            <Text style={[styles.itemTitle, { color: Brand.red }]}>Sign out</Text>
            <Text style={styles.itemSub}>Clears the token from the device</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  content: { padding: 16 },
  header: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: Brand.primary },
  name: { fontSize: 16, fontWeight: '800', color: Brand.ink },
  email: { fontSize: 12, color: Brand.muted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: Brand.ink },
  itemSub: { fontSize: 11, color: Brand.muted, marginTop: 1 },
});
