import { Redirect, Slot, router, usePathname } from 'expo-router';
import { View, Text, Image, Pressable, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/src/store/useSessionStore';
import { colors } from '@/src/theme/colors';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';
import { sectionsFor } from '@/src/navigation';
import { PendingCount, PendingCountsContext, useLoadPendingCounts } from '@/src/hooks/usePendingCounts';

type PressableState = { pressed: boolean; hovered?: boolean };

// This is a staff tool used primarily from a PC browser -- unlike mobile's
// phone-first stack-with-back-button navigation, the admin shell is a
// persistent sidebar (desktop) around a `<Slot />` so switching sections
// never re-mounts the chrome. Below DESKTOP_BREAKPOINT (a narrow window or
// an actual phone browser) it collapses into a top bar + horizontal nav so
// it still works, just not optimized for that width.
function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>© {new Date().getFullYear()} ParkLink. Todos los derechos reservados.</Text>
    </View>
  );
}

function CountPill({ count, active }: { count: PendingCount; active: boolean }) {
  if (!count) return null;
  return (
    <View style={[styles.countPill, active && styles.countPillActive]}>
      <Text style={[styles.countPillText, active && styles.countPillTextActive]}>{count}</Text>
    </View>
  );
}

export default function AdminLayout() {
  const user = useSessionStore((s) => s.user);
  const hydrated = useSessionStore((s) => s.hydrated);
  const clearSession = useSessionStore((s) => s.clearSession);
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const pendingCounts = useLoadPendingCounts(!!user, pathname);

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const navItems = sectionsFor(user.role);

  // Admin sessions have no refresh token to revoke server-side (see
  // src/api/auth.ts) -- logging out is purely a client-side action.
  function handleLogout() {
    clearSession();
    router.replace('/(auth)/login');
  }

  function isActive(match: string) {
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <View style={styles.sidebar}>
          <View>
            <Image source={require('@/assets/logo-letras-darkmode.png')} style={styles.brandLogo} resizeMode="contain" />
            <View style={styles.userRow}>
              <Text style={styles.brandUsername} numberOfLines={1}>Usuario: {user.username}</Text>
              <Pressable onPress={handleLogout} style={{ cursor: 'pointer' } as unknown as ViewStyle}>
                {({ hovered }: PressableState) => (
                  <Text style={[styles.brandUsername, hovered && styles.logoutHovered]}>Cerrar sesión</Text>
                )}
              </Pressable>
            </View>
          </View>
          {/* The menu scrolls on its own when the window is too short for every section. */}
          <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarNav} showsVerticalScrollIndicator={false}>
            {navItems.map((item) => {
              const active = isActive(item.match);
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href as never)}
                  style={({ hovered }: PressableState) => [
                    styles.sidebarItem,
                    active && styles.sidebarItemActive,
                    hovered && !active && styles.sidebarItemHovered,
                    { cursor: 'pointer' } as unknown as ViewStyle,
                  ]}
                >
                  <Ionicons name={item.icon} size={18} color={active ? colors.white : colors.textSecondary} />
                  <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>{item.label}</Text>
                  {item.pendingCount ? <CountPill count={pendingCounts[item.pendingCount]} active={active} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.desktopContent}>
          <PendingCountsContext.Provider value={pendingCounts}>
            <Slot />
          </PendingCountsContext.Provider>
          <Footer />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <View style={styles.mobileTopBar}>
        <Image source={require('@/assets/logo-letras-darkmode.png')} style={styles.mobileBrandLogo} resizeMode="contain" />
        <Pressable onPress={handleLogout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.mobileNavScroll}
        contentContainerStyle={styles.mobileNav}
      >
        {navItems.map((item) => {
          const active = isActive(item.match);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[styles.mobileNavItem, active && styles.mobileNavItemActive]}
            >
              <Ionicons name={item.icon} size={15} color={active ? colors.white : colors.textSecondary} />
              <Text style={[styles.mobileNavItemText, active && styles.mobileNavItemTextActive]}>{item.label}</Text>
              {item.pendingCount ? <CountPill count={pendingCounts[item.pendingCount]} active={active} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.mobileContent}>
        <PendingCountsContext.Provider value={pendingCounts}>
          <Slot />
        </PendingCountsContext.Provider>
        <Footer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  countPill: { marginLeft: 'auto', minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: colors.warning, alignItems: 'center' },
  countPillActive: { backgroundColor: colors.white },
  countPillText: { fontSize: 11, fontWeight: '700', color: colors.white },
  countPillTextActive: { color: colors.deepNavy },
  footer: { paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
  footerText: { fontSize: 12, color: colors.textSecondary },
  // Desktop: fixed sidebar + flexible content pane, both full viewport height.
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  sidebar: {
    width: 240,
    backgroundColor: colors.deepNavy,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  // logo-letras-darkmode.png is 2170x725 (~2.99:1), different proportions
  // than the light logo -- sized to match that ratio, not copied from it.
  brandLogo: { width: 152, height: 51 },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  brandUsername: { flexShrink: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  logoutHovered: { color: colors.white, textDecorationLine: 'underline' },
  sidebarScroll: { flex: 1, marginTop: 24 },
  mobileBrandLogo: { width: 120, height: 40 },
  sidebarNav: { gap: 4 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  sidebarItemActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  sidebarItemHovered: { backgroundColor: 'rgba(255,255,255,0.06)' },
  sidebarItemText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  sidebarItemTextActive: { color: colors.white },
  desktopContent: { flex: 1, minWidth: 0 },

  // Narrow fallback: top bar with a horizontally-scrollable nav strip.
  mobileRoot: { flex: 1, backgroundColor: colors.background },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.deepNavy,
  },
  mobileNavScroll: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  mobileNav: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  mobileNavItemActive: { backgroundColor: colors.deepNavy },
  mobileNavItemText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  mobileNavItemTextActive: { color: colors.white },
  mobileContent: { flex: 1 },
});
