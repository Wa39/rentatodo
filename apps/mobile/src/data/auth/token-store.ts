import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Access-token persistence. SecureStore has no web implementation in
 * SDK 57, so the web build (used for quick demos) falls back to
 * localStorage. Native builds keep the token in the device keychain.
 */

const TOKEN_KEY = 'rentatodo_access_token';

let warnedInsecureWebStorage = false;

/** The web fallback keeps the token in localStorage, which is not secure storage. */
function warnInsecureWebStorage(): void {
  if (warnedInsecureWebStorage) return;
  warnedInsecureWebStorage = true;
  console.warn(
    '[token-store] Web build: the access token is kept in localStorage, not secure ' +
      'storage. The web target is for demos only; native builds use the device keychain.',
  );
}

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    warnInsecureWebStorage();
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function storeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    warnInsecureWebStorage();
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
