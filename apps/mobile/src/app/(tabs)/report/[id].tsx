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
import { photoUploader, type LocalPhoto } from '@/data/photo-uploader';

/**
 * Report a problem (contract: reason + photo_url required, only from
 * delivered|returned, ONE report per reservation). Creating it freezes
 * the deposit until the team resolves the dispute; the reservation
 * status does not change. On mobile only the renter reports — the owner
 * reports from the web (scope rule).
 */
export default function ReportProblemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = reason.trim() !== '' && photo !== null && !submitting;

  async function pickFromCamera() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Se necesita permiso de cámara para documentar el problema.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  }

  async function pickFromLibrary() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  }

  async function onSubmit() {
    if (!id || !photo || reason.trim() === '') return;
    setError(null);
    setSubmitting(true);
    try {
      const photoUrl = await photoUploader.upload(photo);
      await dataSource.reportProblem(id, reason.trim(), photoUrl);
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
          <Text style={styles.topBarTitle}>Reportar problema</Text>
        </View>

        <View style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={18} color="#7A2A1D" />
          <Text style={styles.warningText}>
            Al enviar el reporte, el depósito queda congelado hasta que el equipo resuelva la
            disputa. Solo se permite un reporte por reserva.
          </Text>
        </View>

        <Text style={styles.label}>¿Qué problema encontró? *</Text>
        <TextInput
          style={styles.reason}
          value={reason}
          onChangeText={setReason}
          placeholder="Ej.: La broca estaba quebrada al recibir el taladro"
          placeholderTextColor={Brand.muted}
          multiline
        />

        <Text style={styles.label}>Foto del problema *</Text>
        <View style={styles.photoBox}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={40} color={Brand.muted} />
              <Text style={styles.photoHint}>Evidencia obligatoria del daño o problema</Text>
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

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          disabled={!canSubmit}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Enviar reporte</Text>
          )}
        </Pressable>
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
  warning: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F7E0DB',
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  warningText: { flex: 1, fontSize: 12, color: '#7A2A1D', lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.ink, marginTop: 16, marginBottom: 6 },
  reason: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: Brand.ink,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  photoBox: {
    height: 200,
    borderRadius: 16,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
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
  error: { color: Brand.red, fontSize: 12, marginTop: 12, textAlign: 'center' },
  cta: {
    backgroundColor: Brand.red,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
