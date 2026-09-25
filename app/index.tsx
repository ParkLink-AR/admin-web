import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  const hydrated = useSessionStore((s) => s.hydrated);

  // Wait for secureStorage rehydration before deciding where to redirect, to
  // avoid a flash of the login screen for an already-signed-in admin.
  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(admin)/home" />;
}
