import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider } from '@/context/session-context';

SplashScreen.preventAutoHideAsync();

/**
 * Root navigation: a Stack with the tab group plus the auth screens.
 * The session guard lives in (tabs)/_layout.tsx — while signed out the
 * app redirects to /login.
 */
export default function RootLayout() {
  return (
    <SessionProvider>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    </SessionProvider>
  );
}
