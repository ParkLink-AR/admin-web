import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '@/src/services/secureStorage';

export type AdminRole = 'SUPERADMIN' | 'ADMIN';

// Admin accounts are a separate identity system from regular ParkLink users
// (their own table in auth-service, unrelated to the `users` table) --
// there's no email here, just the admin's own id/username/role.
export interface AdminSessionUser {
  id: string;
  username: string;
  role: AdminRole;
}

interface SessionState {
  user: AdminSessionUser | null;
  accessToken: string | null;
  hydrated: boolean;
  setSession: (user: AdminSessionUser, tokens: { accessToken: string; expiresIn: number }) => void;
  clearSession: () => void;
}

// Admin sessions don't have a refresh token -- POST /admin/auth/login returns
// a single longer-lived access_token and nothing rotates it server-side.
// When it expires the admin just logs in again (see src/api/client.ts).
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      hydrated: false,
      setSession: (user, tokens) => set({ user, accessToken: tokens.accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'admin-session-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);

// `hydrated` is deliberately excluded from `partialize` (must always start
// false on load) and flipped once secureStorage rehydration finishes, so
// app/index.tsx can wait for it before deciding where to redirect. Mirrors
// mobile/src/store/useSessionStore.ts.
useSessionStore.persist.onFinishHydration(() => {
  useSessionStore.setState({ hydrated: true });
});
if (useSessionStore.persist.hasHydrated()) {
  useSessionStore.setState({ hydrated: true });
}
