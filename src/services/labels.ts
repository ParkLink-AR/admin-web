import { BookingStatus } from '@/src/types';

/** Why a booking was cancelled, in words. */
export const CANCELLATION_TEXT: Record<string, string> = {
  OWNER_REJECTED: 'Rechazada por el propietario',
  OWNER_EXPIRED: 'El propietario no respondió a tiempo',
  DRIVER_CANCELLED: 'Cancelada por el conductor',
  OWNER_ACCOUNT_CLOSED: 'Cuenta del propietario cerrada o suspendida',
  DRIVER_ACCOUNT_CLOSED: 'Cuenta del conductor cerrada o suspendida',
  ADMIN_CANCELLED: 'Cancelada por ParkLink',
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
