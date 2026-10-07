export type AccountType = 'DRIVER' | 'OWNER' | 'BOTH';
// PENDING_DELETION: waiting out its deletion grace period (asked for by the user) or, when
// an admin scheduled it, until ParkLink has paid the owner what it owes them.
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION' | 'DELETED';

export interface AdminUserSummary {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  accountType: AccountType;
  status: UserStatus;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  dni: string | null;
  avatarUrl: string | null;
  cbu: string | null;
  payoutTitular: string | null;
  cuil: string | null;
  hasPayoutInfo: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendedByAdminId: string | null;
  suspensionReason: string | null;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  // Set when an admin deleted the account at its holder's request (not the user from the app).
  deletionRequestedByAdminId: string | null;
  deletionReason: string | null;
  deletedAt: string | null;
}

// What suspending or deleting an account would do (GET /admin/users/{id}/closure-summary).
export interface AccountClosureSummary {
  blocked: boolean;
  blockedReason: string | null;
  inProgressCount: number;
  driverBookingsToCancel: number;
  ownerBookingsToCancel: number;
  ownerRequestsToReject: number;
  pendingPayoutCount: number;
  pendingPayoutAmount: number; // centavos
  spotCount: number;
}

// pending_review / rejected: la cochera recién creada espera la decisión de un admin (ver
// listPendingParkingSpots / reviewParkingSpot); mientras tanto no aparece en las búsquedas.
export type ParkingSpotStatus = 'pending_review' | 'active' | 'paused' | 'rejected' | 'deleted';

export type SpotReviewDecision = 'approved' | 'rejected';

export interface ParkingSpot {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  hourlyEnabled: boolean;
  pricePerHour: number | null;
  stayEnabled: boolean;
  pricePerDay: number | null;
  pricePerWeek: number | null;
  pricePerMonth: number | null;
  covered: boolean;
  vehicleTypes: string[];
  capacity: number;
  photos: string[];
  // Fotos de respaldo que subió el dueño para que un admin verifique la cochera -- no se
  // muestran al conductor. reviewNotes es el motivo cuando la cochera fue rechazada.
  verificationPhotos: string[];
  reviewNotes: string | null;
  status: ParkingSpotStatus;
  createdAt: string;
  updatedAt: string;
  rating: number | null;
  reviewCount: number;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PENDING_OWNER_APPROVAL'
  | 'IN_PROGRESS';

export type BookingKind = 'HOURLY' | 'STAY';

// A booking this user made as a driver -- GET /users/{id}/bookings/history.
export interface DriverBooking {
  id: string;
  parkingSpotId: string;
  userId: string;
  start: string;
  end: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  amount: number; // centavos
  paymentId: string | null;
  paidAt: string | null;
  cancellationReason: string | null;
  kind: BookingKind;
  verificationCode: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

// A booking received across every spot this user owns -- GET
// /admin/owners/{id}/bookings.
export interface OwnerReceivedBooking {
  id: string;
  parkingSpotId: string;
  userId: string;
  start: string;
  end: string;
  status: BookingStatus;
  amount: number; // centavos
  paymentId: string | null;
  paidAt: string | null;
  cancellationReason: string | null;
  kind: BookingKind;
  updatedAt: string;
}

// A paid booking that reached COMPLETED without the owner ever entering the driver's
// arrival code -- GET /admin/bookings/unverified. Its payout is held back until an admin
// approves (the owner gets paid) or refunds it (the driver gets their money back).
export type VerificationReviewDecision = 'APPROVED' | 'REFUNDED';

export interface UnverifiedBooking {
  id: string;
  parkingSpotId: string;
  userId: string;
  start: string;
  end: string;
  kind: BookingKind;
  amount: number; // centavos, what the driver paid
  ownerAmount: number | null; // centavos, the owner's own price (before commission)
  paymentId: string | null;
  paidAt: string | null;
  vehiclePlate: string | null;
}

export type PayoutStatus = 'PENDING' | 'PAID';

export interface Payout {
  id: string;
  bookingId: string;
  ownerId: string;
  grossAmount: number; // centavos
  commissionAmount: number; // centavos
  netAmount: number; // centavos
  status: PayoutStatus;
  paidAt: string | null;
  paidByAdminId: string | null;
  proofUrl: string | null;
  // Which Settlement this payout was frozen into, once an admin drafts one for its
  // owner -- null while it's still unattached (see OwnerPendingBalance/getOwnerPendingPayouts).
  settlementId: string | null;
  createdAt: string;
}

// One owner who currently has >=1 unattached (not yet drafted into any settlement)
// payout -- GET /admin/owners/pending-balances, the new "who do I owe money to" screen.
export interface OwnerPendingBalance {
  ownerId: string;
  pendingNetAmount: number; // centavos
  pendingCount: number;
  oldestPendingAt: string;
}

export type SettlementStatus = 'PENDING' | 'PAID';

// A booking-level line item inside a Settlement -- same shape as a Payout minus the
// fields that don't make sense once it's bundled (status/ownerId/paidAt/etc. all live
// on the parent Settlement instead).
export interface SettlementPayout {
  id: string;
  bookingId: string;
  grossAmount: number; // centavos
  commissionAmount: number; // centavos
  netAmount: number; // centavos
}

// Batched payout to an owner -- replaces per-payout mark-paid. Drafted via
// POST /admin/owners/{id}/settlements (freezes every currently-pending payout for that
// owner), then confirmed via POST /admin/settlements/{id}/confirm once the real bank
// transfer went out, or cancelled via POST /admin/settlements/{id}/cancel to release its
// payouts back to unattached.
export interface Settlement {
  id: string;
  ownerId: string;
  grossAmount: number; // centavos
  commissionAmount: number; // centavos
  netAmount: number; // centavos
  status: SettlementStatus;
  proofUrl: string | null;
  paidAt: string | null; // set only once confirmed
  paidByAdminId: string | null; // set only once confirmed
  createdByAdminId: string; // set at draft time
  createdAt: string;
  // Only populated on the single-settlement detail fetch, omitted on list items.
  payouts?: SettlementPayout[];
}

export interface CommissionSettings {
  commissionRateBp: number;
  commissionRatePercent: number;
}

// Admin accounts are a separate identity system (their own table in
// auth-service, unrelated to `AdminUserSummary`/the `users` table) --
// username-based, no email, gated by SUPERADMIN vs ADMIN role.
export type AdminAccountRole = 'SUPERADMIN' | 'ADMIN';

export interface AdminAccount {
  id: string;
  username: string;
  role: AdminAccountRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
