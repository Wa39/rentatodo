import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';

/**
 * Profile — per the contract (UserResponse): id, name, email, created_at.
 * The zone concept is out of the contract ("near me" was removed from scope).
 * Payment method is simulated (mock): there are no real payments in this project.
 */
export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>Z</Text>
          </View>
          <Text style={styles.name}>Persona arrendataria</Text>
          <Text style={styles.email}>cuenta de prueba · datos mock</Text>
        </View>

        <View style={styles.item}>
          <Ionicons name="card-outline" size={19} color={Brand.teal} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Método de pago</Text>
            <Text style={styles.itemSub}>Simulado (mock) · sin cargos reales</Text>
          </View>
        </View>

        <View style={styles.item}>
          <Ionicons name="settings-outline" size={19} color={Brand.teal} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Configuración</Text>
            <Text style={styles.itemSub}>Notificaciones dentro de la app (polling)</Text>
          </View>
        </View>

        <View style={styles.item}>
          <Ionicons name="log-out-outline" size={19} color={Brand.red} />
          <View style={styles.itemInfo}>
            <Text style={[styles.itemTitle, { color: Brand.red }]}>Cerrar sesión</Text>
            <Text style={styles.itemSub}>La autenticación llega con el contrato congelado</Text>
          </View>
        </View>
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
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: Brand.teal },
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
