import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';

/**
 * Perfil — según el contrato (UserResponse): id, name, email, created_at.
 * El concepto de zona quedó fuera del contrato (se eliminó "Cerca de mí").
 * El método de pago es simulado (mock): no hay pagos reales en el proyecto.
 */
export default function Perfil() {
  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.contenido}>
        <View style={styles.cabecera}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>Z</Text>
          </View>
          <Text style={styles.nombre}>Persona arrendataria</Text>
          <Text style={styles.correo}>cuenta de prueba · datos mock</Text>
        </View>

        <View style={styles.item}>
          <Ionicons name="card-outline" size={19} color={Brand.teal} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitulo}>Método de pago</Text>
            <Text style={styles.itemSub}>Simulado (mock) · sin cargos reales</Text>
          </View>
        </View>

        <View style={styles.item}>
          <Ionicons name="log-out-outline" size={19} color={Brand.red} />
          <View style={styles.itemInfo}>
            <Text style={[styles.itemTitulo, { color: Brand.red }]}>Cerrar sesión</Text>
            <Text style={styles.itemSub}>La autenticación llega con el contrato de Trucy</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: Brand.paper },
  contenido: { padding: 16 },
  cabecera: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontSize: 24, fontWeight: '800', color: Brand.teal },
  nombre: { fontSize: 16, fontWeight: '800', color: Brand.ink },
  correo: { fontSize: 12, color: Brand.muted },
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
  itemTitulo: { fontSize: 13, fontWeight: '700', color: Brand.ink },
  itemSub: { fontSize: 11, color: Brand.muted, marginTop: 1 },
});
