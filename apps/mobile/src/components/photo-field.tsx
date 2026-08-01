import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import type { LocalPhoto } from '@/data/photo-uploader';

/**
 * Photo-evidence field shared by the check-in/out and report screens:
 * a preview-or-placeholder box plus the camera/library pick buttons.
 * `testIDPrefix` yields "<prefix>-photo-hint", "<prefix>-pick-camera" and
 * "<prefix>-pick-library" so the Maestro flows keep their stable ids.
 */
export function PhotoField({
  photo,
  hint,
  testIDPrefix,
  onPickCamera,
  onPickLibrary,
}: {
  photo: LocalPhoto | null;
  hint: string;
  testIDPrefix: string;
  onPickCamera: () => void;
  onPickLibrary: () => void;
}) {
  return (
    <>
      <View style={styles.photoBox}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={40} color={Brand.muted} />
            <Text testID={`${testIDPrefix}-photo-hint`} style={styles.photoHint}>
              {hint}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.pickRow}>
        {Platform.OS !== 'web' && (
          <Pressable
            testID={`${testIDPrefix}-pick-camera`}
            style={styles.pickButton}
            onPress={onPickCamera}>
            <Ionicons name="camera-outline" size={18} color={Brand.primary} />
            <Text style={styles.pickText}>Take photo</Text>
          </Pressable>
        )}
        <Pressable
          testID={`${testIDPrefix}-pick-library`}
          style={styles.pickButton}
          onPress={onPickLibrary}>
          <Ionicons name="image-outline" size={18} color={Brand.primary} />
          <Text style={styles.pickText}>
            {Platform.OS === 'web' ? 'Choose file' : 'Choose from gallery'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  photoBox: {
    height: 200,
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
});
