import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoField } from '@/components/photo-field';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { errorMessage } from '@/data/labels';
import { photoUploader } from '@/data/photo-uploader';
import { usePhotoPicker } from '@/hooks/use-photo-picker';

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { photo, pickFromCamera, pickFromLibrary } = usePhotoPicker(
    'Camera permission is required to document the problem.',
    setError,
  );

  const canSubmit = reason.trim() !== '' && photo !== null && !submitting;

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
          <Text testID="report-title" style={styles.topBarTitle}>Report a problem</Text>
        </View>

        <View style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={18} color="#7A2A1D" />
          <Text style={styles.warningText}>
            When you send the report, the deposit is frozen until the team resolves the dispute.
            Only one report is allowed per reservation.
          </Text>
        </View>

        <Text style={styles.label}>What problem did you find? *</Text>
        <TextInput
          testID="report-reason"
          style={styles.reason}
          value={reason}
          onChangeText={setReason}
          placeholder="E.g.: The bit was broken when I received the drill"
          placeholderTextColor={Brand.muted}
          multiline
        />

        <Text style={styles.label}>Photo of the problem *</Text>
        <PhotoField
          photo={photo}
          hint="Required evidence of the damage or problem"
          testIDPrefix="report"
          onPickCamera={pickFromCamera}
          onPickLibrary={pickFromLibrary}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          testID="report-submit"
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          disabled={!canSubmit}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Send report</Text>
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
