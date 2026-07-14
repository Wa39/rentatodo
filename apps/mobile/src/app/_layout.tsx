import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Brand } from '@/constants/brand';

SplashScreen.preventAutoHideAsync();

/**
 * Navegación principal: SOLO 3 pestañas (decisión de diseño del equipo).
 * La cámara NO va aquí: solo existe dentro del flujo de check-in/check-out.
 * En la app móvil no hay ninguna pantalla de publicar artículos (regla de alcance).
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
          name="rentas"
          options={{
            title: 'Mis rentas',
            tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" color={color} size={size} />
            ),
          }}
        />
        {/* Detalle de artículo: ruta interna, no aparece en la barra de pestañas */}
        <Tabs.Screen name="articulo/[id]" options={{ href: null }} />
      </Tabs>
    </>
  );
}
