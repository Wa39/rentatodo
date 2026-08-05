import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoField } from '@/components/photo-field';
import { ScreenHeader } from '@/components/screen-header';
import { Brand } from '@/constants/brand';
import { dataSource } from '@/data/data-source';
import { errorMessage } from '@/data/labels';
import { photoUploader } from '@/data/photo-uploader';
import { usePhotoPicker } from '@/hooks/use-photo-picker';

/**
 * Check-in / check-out with photo evidence (contract: photo_url required,
 * notes optional, ONE photo — scope rule). mode=in registers the pickup
 * (approved → delivered); mode=out registers the return
 * (delivered → returned). This is the only place the camera appears.
 */
export default function CheckScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: string }>();
  const isCheckIn = mode !== 'out';

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { photo, pickFromCamera, pickFromLibrary } = usePhotoPicker(
    'Camera permission is required to document the item condition.',
    setError,
  );

  async function onSubmit() {
    if (!id || !photo) return;
    setError(null);
    setSubmitting(true);
    try {
      const photoUrl = await photoUploader.upload(photo);
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
        <ScreenHeader
          title={isCheckIn ? 'Check-in · Receive item' : 'Check-out · Return item'}
          titleTestID="check-title"
        />

        <Text style={styles.explain}>
          {isCheckIn
            ? 'Take a photo of the item when you receive it. It is the evidence of its initial condition and protects your deposit.'
            : 'Take a photo of the item when you return it. It is the evidence that you hand it back in good condition.'}
        </Text>

        <PhotoField
          photo={photo}
          hint="A single photo as evidence"
          testIDPrefix="check"
          onPickCamera={pickFromCamera}
          onPickLibrary={pickFromLibrary}
        />

        <Text testID="check-notes-label" style={styles.label}>Condition notes (optional)</Text>
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder={
            isCheckIn ? 'E.g.: Received with case and 3 bits' : 'E.g.: Returned complete and clean'
          }
          placeholderTextColor={Brand.muted}
          multiline
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          testID="check-submit"
          style={[styles.cta, (!photo || submitting) && styles.ctaDisabled]}
          disabled={!photo || submitting}
          onPress={onSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              {isCheckIn ? 'Confirm receipt' : 'Confirm return'}
            </Text>
          )}
        </Pressable>
        <Text style={styles.note}>
          {isCheckIn
            ? 'The reservation moves to "Delivered".'
            : 'The reservation moves to "Returned"; the deposit is released when the owner closes with no reports.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  content: { padding: 16 },
  explain: { fontSize: 12.5, color: Brand.muted, lineHeight: 18, marginTop: 4 },
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
