import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import {
  AccountType,
  AdminAccountRole,
  BookingStatus,
  ParkingSpotStatus,
  SettlementStatus,
  TicketStatus,
  UserStatus,
} from '@/src/types';

// Generic colored pill -- this app has several independent status enums
// (user, booking, payout, spot), unlike mobile's single BookingStatus-typed
// StatusBadge, so this takes a plain label/color instead of one type union.
export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'ACTIVO',
  SUSPENDED: 'SUSPENDIDO',
  PENDING_DELETION: 'ELIMINÁNDOSE',
  DELETED: 'ELIMINADO',
};
const USER_STATUS_COLOR: Record<UserStatus, string> = {
  ACTIVE: colors.success,
  SUSPENDED: colors.warning,
  PENDING_DELETION: colors.danger,
  DELETED: colors.danger,
};
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge label={USER_STATUS_LABEL[status]} color={USER_STATUS_COLOR[status]} />;
}

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  DRIVER: 'CONDUCTOR',
  OWNER: 'DUEÑO',
  BOTH: 'CONDUCTOR + DUEÑO',
};
export function AccountTypeBadge({ accountType }: { accountType: AccountType }) {
  return <Badge label={ACCOUNT_TYPE_LABEL[accountType]} color={colors.deepNavy} />;
}

const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'PENDIENTE DE PAGO',
  CONFIRMED: 'CONFIRMADA',
  COMPLETED: 'FINALIZADA',
  CANCELLED: 'CANCELADA',
  EXPIRED: 'EXPIRADA',
  PENDING_OWNER_APPROVAL: 'A CONFIRMAR',
  IN_PROGRESS: 'EN CURSO',
};
const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  PENDING_PAYMENT: colors.warning,
  CONFIRMED: colors.success,
  COMPLETED: colors.deepNavy,
  CANCELLED: colors.textSecondary,
  EXPIRED: colors.textSecondary,
  PENDING_OWNER_APPROVAL: colors.warning,
  IN_PROGRESS: colors.teal,
};
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge label={BOOKING_STATUS_LABEL[status]} color={BOOKING_STATUS_COLOR[status]} />;
}

const SPOT_STATUS_LABEL: Record<ParkingSpotStatus, string> = {
  pending_review: 'PENDIENTE DE REVISIÓN',
  active: 'ACTIVA',
  paused: 'PAUSADA',
  rejected: 'RECHAZADA',
  deleted: 'ELIMINADA',
};
const SPOT_STATUS_COLOR: Record<ParkingSpotStatus, string> = {
  pending_review: colors.warning,
  active: colors.success,
  paused: colors.warning,
  rejected: colors.danger,
  deleted: colors.danger,
};
export function SpotStatusBadge({ status }: { status: ParkingSpotStatus }) {
  return <Badge label={SPOT_STATUS_LABEL[status]} color={SPOT_STATUS_COLOR[status]} />;
}

const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  PENDING: 'A CONFIRMAR',
  PAID: 'PAGADA',
};
const SETTLEMENT_STATUS_COLOR: Record<SettlementStatus, string> = {
  PENDING: colors.warning,
  PAID: colors.success,
};
export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return <Badge label={SETTLEMENT_STATUS_LABEL[status]} color={SETTLEMENT_STATUS_COLOR[status]} />;
}

const ADMIN_ROLE_LABEL: Record<AdminAccountRole, string> = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
};
const ADMIN_ROLE_COLOR: Record<AdminAccountRole, string> = {
  SUPERADMIN: colors.deepNavy,
  ADMIN: colors.teal,
};
export function AdminRoleBadge({ role }: { role: AdminAccountRole }) {
  return <Badge label={ADMIN_ROLE_LABEL[role]} color={ADMIN_ROLE_COLOR[role]} />;
}

export function AdminActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge label={isActive ? 'ACTIVO' : 'INACTIVO'} color={isActive ? colors.success : colors.textSecondary} />
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'ABIERTO',
  IN_PROGRESS: 'EN CURSO',
  RESOLVED: 'RESUELTO',
  CLOSED: 'CERRADO',
};
const TICKET_STATUS_COLOR: Record<TicketStatus, string> = {
  OPEN: colors.warning,
  IN_PROGRESS: colors.teal,
  RESOLVED: colors.success,
  CLOSED: colors.textSecondary,
};
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge label={TICKET_STATUS_LABEL[status]} color={TICKET_STATUS_COLOR[status]} />;
}
