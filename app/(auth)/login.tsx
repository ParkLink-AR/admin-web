import { useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { login, NotAdminError } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);

  async function handleLogin() {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Ingresá tu email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { user, tokens } = await login({ email: normalizedEmail, password });
      setSession(user, tokens);
      router.replace('/(admin)/home');
    } catch (err) {
      if (err instanceof NotAdminError) {
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError('No se pudo iniciar sesión. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.title}>ParkLink Admin</Text>
        <Text style={styles.subtitle}>Herramienta interna de soporte y pagos</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Button title="Ingresar" onPress={handleLogin} />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  inner: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
});
