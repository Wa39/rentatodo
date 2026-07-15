import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';

import { Brand } from '@/constants/brand';
import { useSession } from '@/context/session-context';

/**
 * Main navigation: ONLY 3 tabs (team design decision).
 * The camera does NOT live here: it only appears inside the check-in/out flow.
 * The mobile app has no publish screens whatsoever (scope rule).
 *
 * Session guard: the tabs require a signed-in user.
 */
export default function TabLayout() {
  const { status } = useSession();

  // While restoring the session the splash overlay is still covering the app.
  if (status === 'loading') return null;
  if (status === 'signed_out') return <Redirect href="/login" />;

  return (
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
      {/* Internal routes, hidden from the tab bar */}
      <Tabs.Screen name="item/[id]" options={{ href: null }} />
      <Tabs.Screen name="reservation/[id]" options={{ href: null }} />
    </Tabs>
  );
}
