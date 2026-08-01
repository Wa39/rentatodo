import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import type { LocalPhoto } from '@/data/photo-uploader';

/**
 * Single-photo acquisition shared by check-in/out and problem reports:
 * one photo, camera or library, quality 0.7 (scope rule: never more than
 * one). Owns the photo state and the two pickers; a denied camera
 * permission is surfaced through the screen's own `setError` with a
 * screen-specific message.
 */
export function usePhotoPicker(deniedMessage: string, setError: (message: string | null) => void) {
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);

  async function pickFromCamera() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError(deniedMessage);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  }

  async function pickFromLibrary() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  }

  return { photo, pickFromCamera, pickFromLibrary };
}
