import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Brand } from '@/constants/brand';

SplashScreen.preventAutoHideAsync();

/**
 * Main navigation: ONLY 3 tabs (team design decision).
 * The camera does NOT live here: it only appears inside the check-in/out flow.
 * The mobile app has no publish screens whatsoever (scope rule).
 */
export default function TabLayout() {
  return (
    <>
      <AnimatedSplashOverlay />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Brand.teal,
          tabBarInactiveTintColor: Brand.muted,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="rentals"
          options={{
            title: 'Mis rentas',
            tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" color={color} size={size} />
            ),
          }}
        />
        {/* Item detail: internal route, hidden from the tab bar */}
        <Tabs.Screen name="item/[id]" options={{ href: null }} />
      </Tabs>
    </>
  );
}
