import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { useSession } from '@/context/session-context';
import { errorMessage } from '@/data/labels';

/**
 * Register — POST /auth/register (frozen contract: name, email,
 * password 8-72 chars) followed by an automatic login.
 */
export default function RegisterScreen() {
  const { status, register } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signed_in') return <Redirect href="/" />;

  const canSubmit = name.trim() !== '' && email.trim() !== '' && password !== '' && !submitting;

  async function onSubmit() {
    // The contract requires an 8-72 character password; validate before the round trip.
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      // Redirect happens via the status check above on re-render.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Solo se necesita nombre, correo y contraseña</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nombre y apellido"
            placeholderTextColor={Brand.muted}
            autoComplete="name"
          />

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={Brand.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={Brand.muted}
            secureTextEntry
            autoComplete="new-password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit}
            onPress={onSubmit}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Crear cuenta</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tiene cuenta?</Text>
            <Link href="/login" style={styles.footerLink}>
              Iniciar sesión
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.paper },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: Brand.ink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: Brand.muted, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.ink, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Brand.ink,
  },
  error: { color: Brand.red, fontSize: 12, marginTop: 12 },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 },
  footerText: { fontSize: 13, color: Brand.muted },
  footerLink: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});
