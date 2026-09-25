import { Redirect, Slot, router, usePathname } from 'expo-router';
import { View, Text, Pressable, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '@/src/store/useSessionStore';
import { colors } from '@/src/theme/colors';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';

type PressableState = { pressed: boolean; hovered?: boolean };

const NAV_ITEMS: { href: string; match: string; label: string; icon: keyof typeof Ionicons.glyphMap; superadminOnly?: boolean }[] = [
  { href: '/(admin)/home', match: '/home', label: 'Inicio', icon: 'home' },
  { href: '/(admin)/users', match: '/users', label: 'Buscar usuarios', icon: 'people' },
  { href: '/(admin)/payouts', match: '/payouts', label: 'Pagos pendientes', icon: 'cash' },
  { href: '/(admin)/accounts', match: '/accounts', label: 'Administradores', icon: 'shield-checkmark', superadminOnly: true },
  { href: '/(admin)/settings', match: '/settings', label: 'Configuración', icon: 'settings' },
];

// This is a staff tool used primarily from a PC browser -- unlike mobile's
// phone-first stack-with-back-button navigation, the admin shell is a
// persistent sidebar (desktop) around a `<Slot />` so switching sections
// never re-mounts the chrome. Below DESKTOP_BREAKPOINT (a narrow window or
// an actual phone browser) it collapses into a top bar + horizontal nav so
// it still works, just not optimized for that width.
export default function AdminLayout() {
  const user = useSessionStore((s) => s.user);
  const hydrated = useSessionStore((s) => s.hydrated);
  const clearSession = useSessionStore((s) => s.clearSession);
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const navItems = NAV_ITEMS.filter((item) => !item.superadminOnly || user.role === 'SUPERADMIN');

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
            <Text style={styles.brand}>ParkLink Admin</Text>
            <Text style={styles.brandUsername} numberOfLines={1}>{user.username}</Text>
          </View>
          <View style={styles.sidebarNav}>
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
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={handleLogout}
            style={({ hovered }: PressableState) => [
              styles.sidebarLogout,
              hovered && styles.sidebarLogoutHovered,
              { cursor: 'pointer' } as unknown as ViewStyle,
            ]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.sidebarLogoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
        <View style={styles.desktopContent}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <View style={styles.mobileTopBar}>
        <Text style={styles.brand}>ParkLink Admin</Text>
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
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.mobileContent}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop: fixed sidebar + flexible content pane, both full viewport height.
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  sidebar: {
    width: 240,
    backgroundColor: colors.deepNavy,
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  brand: { color: colors.white, fontSize: 17, fontWeight: '700' },
  brandUsername: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  sidebarNav: { gap: 4, marginTop: 32 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  sidebarItemActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  sidebarItemHovered: { backgroundColor: 'rgba(255,255,255,0.06)' },
  sidebarItemText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  sidebarItemTextActive: { color: colors.white },
  sidebarLogout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  sidebarLogoutHovered: { backgroundColor: 'rgba(220, 38, 38, 0.1)' },
  sidebarLogoutText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
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
