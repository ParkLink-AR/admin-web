import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSessionStore } from '@/src/store/useSessionStore';
import { ErrorBoundary, initMonitoring, setMonitoringUser } from '@/src/services/monitoring';

initMonitoring();

export default function RootLayout() {
  const username = useSessionStore((s) => s.user?.username ?? null);

  useEffect(() => {
    setMonitoringUser(username);
  }, [username]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
