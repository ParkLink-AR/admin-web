import { Ionicons } from '@expo/vector-icons';
import type { AdminRole } from '@/src/store/useSessionStore';

export interface AdminSection {
  href: string;
  /** Path prefix that marks this section as active in the sidebar. */
  match: string;
  label: string;
  /** One-line summary shown on the Inicio tile. */
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Heading the section is listed under on Inicio (absent for Inicio itself). */
  group?: AdminSectionGroup;
  superadminOnly?: boolean;
  /** Shows how many items wait in this section next to it in the menu. */
  pendingCount?: 'refunds' | 'tickets';
}

export type AdminSectionGroup = 'Revisión' | 'Pagos' | 'Usuarios y equipo' | 'Plataforma';

export const ADMIN_SECTION_GROUPS: AdminSectionGroup[] = ['Revisión', 'Pagos', 'Usuarios y equipo', 'Plataforma'];

// Single source for the sidebar/top nav and the Inicio tiles, so every section
// reachable from the menu is also reachable from Inicio.
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: '/(admin)/home', match: '/home', label: 'Inicio', description: '', icon: 'home' },
  { href: '/(admin)/users', match: '/users', label: 'Buscar usuarios', description: 'Ver perfil, cocheras y reservas de un usuario', icon: 'people', group: 'Usuarios y equipo' },
  { href: '/(admin)/payouts', match: '/payouts', label: 'Saldos pendientes', description: 'Preparar la liquidación de los dueños de cocheras', icon: 'cash', group: 'Pagos' },
  { href: '/(admin)/unverified', match: '/unverified', label: 'Sin verificar', description: 'Reservas terminadas sin código de llegada', icon: 'alert-circle', group: 'Revisión' },
  { href: '/(admin)/spot-review', match: '/spot-review', label: 'Cocheras nuevas', description: 'Revisar y aprobar cocheras antes de publicarlas', icon: 'checkmark-done-circle', group: 'Revisión' },
  { href: '/(admin)/support', match: '/support', label: 'Soporte', description: 'Tickets de conductores y propietarios sobre sus reservas', icon: 'chatbubbles', group: 'Revisión', pendingCount: 'tickets' },
  { href: '/(admin)/refunds', match: '/refunds', label: 'Reembolsos pendientes', description: 'Reembolsos que Mercado Pago no pudo hacer', icon: 'arrow-undo-circle', group: 'Pagos', pendingCount: 'refunds' },
  { href: '/(admin)/settlements', match: '/settlements', label: 'Liquidaciones', description: 'Historial y detalle de las liquidaciones', icon: 'receipt', group: 'Pagos' },
  { href: '/(admin)/accounts', match: '/accounts', label: 'Administradores', description: 'Cuentas de staff con acceso a esta herramienta', icon: 'shield-checkmark', group: 'Usuarios y equipo', superadminOnly: true },
  { href: '/(admin)/settings', match: '/settings', label: 'Configuración', description: 'Porcentaje de comisión de la plataforma', icon: 'settings', group: 'Plataforma' },
];

export function sectionsFor(role: AdminRole | undefined): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => !section.superadminOnly || role === 'SUPERADMIN');
}
