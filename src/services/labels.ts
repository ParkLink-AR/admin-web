import { BookingKind, BookingStatus } from '@/src/types';

/** Why a booking was cancelled, in words. */
export const CANCELLATION_TEXT: Record<string, string> = {
  OWNER_REJECTED: 'Rechazada por el propietario',
  OWNER_EXPIRED: 'El propietario no respondió a tiempo',
  DRIVER_CANCELLED: 'Cancelada por el conductor',
  OWNER_ACCOUNT_CLOSED: 'Cuenta del propietario cerrada o suspendida',
  DRIVER_ACCOUNT_CLOSED: 'Cuenta del conductor cerrada o suspendida',
  ADMIN_CANCELLED: 'Cancelada por ParkLink',
  OWNER_CANCELLED: 'Cancelada por el propietario (ya la había aceptado)',
  DRIVER_LATE_CANCELLED: 'Cancelada por el conductor en la última hora (reembolso parcial)',
};

export const BOOKING_STATUS_TEXT: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Esperando pago',
  PENDING_OWNER_APPROVAL: 'Esperando al propietario',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
};

/** What kind of booking it is, in words. */
export const BOOKING_KIND_TEXT: Record<BookingKind, string> = {
  HOURLY: 'Por hora',
  STAY: 'Estadía',
  HALF_DAY: 'Media estadía (12 h)',
};

export function bookingKindText(kind: BookingKind | string | undefined): string {
  return BOOKING_KIND_TEXT[(kind ?? 'HOURLY') as BookingKind] ?? 'Por hora';
}

/** Whether a booking of this kind ends with the exit code once its arrival was verified --
 * hourly bookings and half-days (see booking-service's BookingKind.TracksExit). */
export function tracksExit(kind: BookingKind | string | undefined): boolean {
  return kind === 'HOURLY' || kind === 'HALF_DAY';
}
