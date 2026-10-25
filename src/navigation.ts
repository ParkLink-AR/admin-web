import { Ionicons } from '@expo/vector-icons';
import type { AdminRole } from '@/src/store/useSessionStore';
import type { PendingKind } from '@/src/hooks/usePendingCounts';

export interface AdminSection {
  href: string;
  /** Path prefix that marks this section as active in the sidebar. */
  match: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  superadminOnly?: boolean;
  /** Shows how many items wait in this section next to it in the menu. */
  pendingCount?: PendingKind;
}

// Single source for the sidebar/top nav.
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: '/(admin)/home', match: '/home', label: 'Inicio', icon: 'home' },
  { href: '/(admin)/bookings', match: '/bookings', label: 'Reservas', icon: 'calendar' },
  { href: '/(admin)/spots', match: '/spots', label: 'Cocheras', icon: 'car' },
  { href: '/(admin)/users', match: '/users', label: 'Buscar usuarios', icon: 'people' },
  { href: '/(admin)/payouts', match: '/payouts', label: 'Saldos pendientes', icon: 'cash' },
  { href: '/(admin)/unverified', match: '/unverified', label: 'Sin verificar', icon: 'alert-circle', pendingCount: 'unverified' },
  { href: '/(admin)/spot-review', match: '/spot-review', label: 'Cocheras nuevas', icon: 'checkmark-done-circle', pendingCount: 'spotReview' },
  { href: '/(admin)/support', match: '/support', label: 'Soporte', icon: 'chatbubbles', pendingCount: 'tickets' },
  { href: '/(admin)/reports', match: '/reports', label: 'Denuncias', icon: 'flag', pendingCount: 'reports' },
  { href: '/(admin)/reviews', match: '/reviews', label: 'Reseñas', icon: 'star' },
  { href: '/(admin)/payments', match: '/payments', label: 'Pagos', icon: 'card' },
  { href: '/(admin)/refunds', match: '/refunds', label: 'Reembolsos pendientes', icon: 'arrow-undo-circle', pendingCount: 'refunds' },
  { href: '/(admin)/settlements', match: '/settlements', label: 'Liquidaciones', icon: 'receipt', pendingCount: 'settlements' },
  { href: '/(admin)/accounts', match: '/accounts', label: 'Administradores', icon: 'shield-checkmark', superadminOnly: true },
  { href: '/(admin)/broadcasts', match: '/broadcasts', label: 'Avisos', icon: 'megaphone' },
  { href: '/(admin)/audit', match: '/audit', label: 'Registro de acciones', icon: 'list', superadminOnly: true },
  { href: '/(admin)/settings', match: '/settings', label: 'Configuración', icon: 'settings' },
];

export function sectionsFor(role: AdminRole | undefined): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => !section.superadminOnly || role === 'SUPERADMIN');
}
