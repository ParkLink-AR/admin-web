import { useState } from 'react';
import { Text, TextInput, Image, View, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { login, NotAdminError } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);

  async function handleLogin() {
    setError(null);
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError('Ingresá tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { user, tokens } = await login({ username: normalizedUsername, password });
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
        <View style={styles.brandRow}>
          <Image source={require('@/assets/logo-letras.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandTag}>Admin</Text>
        </View>
        <Text style={styles.subtitle}>Herramienta interna de soporte y pagos</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="Usuario"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
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
  inner: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', maxWidth: 360, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logo: { width: 176, height: 33 },
  brandTag: {
    fontSize: 12, fontWeight: '700', color: colors.teal, textTransform: 'uppercase',
    borderWidth: 1, borderColor: colors.teal, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
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
