import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '@/src/services/secureStorage';

export interface AdminSessionUser {
  id: string;
  email: string;
}

interface SessionState {
  user: AdminSessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (user: AdminSessionUser, tokens: { accessToken: string; refreshToken: string }) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: (user, tokens) =>
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setTokens: (tokens) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'admin-session-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
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
