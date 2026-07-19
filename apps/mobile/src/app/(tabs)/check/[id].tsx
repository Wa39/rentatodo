import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { errorMessage } from '@/data/labels';
import { photoUploader } from '@/data/photo-uploader';

/**
 * Check-in / check-out with photo evidence (contract: photo_url required,
 * notes optional, ONE photo — scope rule). mode=in registers the pickup
 * (approved → delivered); mode=out registers the return
 * (delivered → returned). This is the only place the camera appears.
 */
export default function CheckScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: string }>();
  const isCheckIn = mode !== 'out';

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickFromCamera() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Se necesita permiso de cámara para documentar el estado del artículo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
  }

  async function onSubmit() {
    if (!id || !photoUri) return;
    setError(null);
    setSubmitting(true);
    try {
      const photoUrl = await photoUploader.upload(photoUri);
      const trimmedNotes = notes.trim() || undefined;
      if (isCheckIn) {
        await dataSource.checkInReservation(id, photoUrl, trimmedNotes);
      } else {
        await dataSource.checkOutReservation(id, photoUrl, trimmedNotes);
      }
      // Back to the detail: polling shows the new status immediately.
      router.replace({ pathname: '/reservation/[id]', params: { id } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Brand.ink} />
          </Pressable>
          <Text style={styles.topBarTitle}>
            {isCheckIn ? 'Check-in · Recibir artículo' : 'Check-out · Devolver artículo'}
          </Text>
        </View>

        <Text style={styles.explain}>
          {isCheckIn
            ? 'Tome una foto del artículo al recibirlo. Es la evidencia de su estado inicial y protege su depósito.'
            : 'Tome una foto del artículo al devolverlo. Es la evidencia de que lo entrega en buen estado.'}
        </Text>

        <View style={styles.photoBox}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={40} color={Brand.muted} />
              <Text style={styles.photoHint}>Una sola foto como evidencia</Text>
            </View>
          )}
        </View>

        <View style={styles.pickRow}>
          {Platform.OS !== 'web' && (
            <Pressable style={styles.pickButton} onPress={pickFromCamera}>
              <Ionicons name="camera-outline" size={18} color={Brand.primary} />
              <Text style={styles.pickText}>Tomar foto</Text>
            </Pressable>
          )}
          <Pressable style={styles.pickButton} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={18} color={Brand.primary} />
            <Text style={styles.pickText}>
              {Platform.OS === 'web' ? 'Elegir archivo' : 'Elegir de galería'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Notas sobre el estado (opcional)</Text>
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder={
            isCheckIn ? 'Ej.: Recibido con maletín y 3 brocas' : 'Ej.: Devuelto completo y limpio'
          }
          placeholderTextColor={Brand.muted}
          multiline
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.cta, (!photoUri || submitting) && styles.ctaDisabled]}
          disabled={!photoUri || submitting}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              {isCheckIn ? 'Confirmar recepción' : 'Confirmar devolución'}
            </Text>
          )}
        </Pressable>
        <Text style={styles.note}>
          {isCheckIn
            ? 'La reserva pasa a “Entregada”.'
            : 'La reserva pasa a “Devuelta”; el depósito se libera cuando la persona propietaria cierra sin reportes.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  content: { padding: 16 },
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
  explain: { fontSize: 12.5, color: Brand.muted, lineHeight: 18, marginTop: 4 },
  photoBox: {
    height: 220,
    borderRadius: 16,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    marginTop: 14,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoHint: { fontSize: 12, color: Brand.muted },
  pickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.primarySoft,
    borderRadius: 12,
    paddingVertical: 12,
  },
  pickText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  label: { fontSize: 12, fontWeight: '700', color: Brand.ink, marginTop: 16, marginBottom: 6 },
  notes: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: Brand.ink,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: { color: Brand.red, fontSize: 12, marginTop: 12, textAlign: 'center' },
  cta: {
    backgroundColor: Brand.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  note: { fontSize: 10.5, color: Brand.muted, textAlign: 'center', marginTop: 8 },
});
