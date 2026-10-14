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
  // Suspendida por ParkLink desde el panel (con el motivo): el dueño no la puede reactivar.
  suspendedByAdmin?: boolean;
  moderationNote?: string | null;
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

// Why Mercado Pago refused a refund (payment-service's describeRefundError): a payment by
// one of Mercado Pago's test users (never refundable through the API), a payment it
// doesn't know, an access token that can't refund it, or a passing failure that the
// automatic retries may still fix.
export type RefundErrorCode = 'test_payment' | 'payment_not_found' | 'unauthorized' | 'transient';

// A refund still owed to a driver after Mercado Pago failed it -- GET /admin/refunds.
export interface FailedRefund {
  paymentId: string;
  bookingId: string | null;
  amount: number; // pesos, what the driver paid
  payerEmail: string | null;
  approvedAt: string | null;
  attempts: number;
  /** The automatic retries gave up (or the failure can never be fixed by retrying). */
  retriesExhausted: boolean;
  errorCode: RefundErrorCode | null;
  lastError: string | null;
  failedAt: string;
  /** The booking it paid for -- null if it couldn't be loaded. */
  booking: {
    id: string;
    userId: string;
    parkingSpotId: string;
    status: BookingStatus;
    kind: BookingKind;
    start: string;
    end: string;
    amount: number; // centavos
    cancellationReason: string | null;
  } | null;
}

/** How an admin closes a failed refund by hand. */
export type RefundResolution = 'refunded_manually' | 'discarded';

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

// ---------------------------------------------------------------------------
// Support tickets (booking-service, /admin/tickets)
// ---------------------------------------------------------------------------

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
/** Which side of the booking opened the ticket. */
export type TicketCreatorRole = 'driver' | 'owner';

/** A ticket as the support list shows it. */
export interface SupportTicketSummary {
  id: string;
  bookingId: string;
  createdBy: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  creatorRole: TicketCreatorRole;
  lastMessageAt: string | null;
  lastMessageFrom: 'user' | 'staff';
  /** Open or in progress, and the user wrote last. */
  awaitingReply: boolean;
  booking: {
    parkingSpotId: string;
    driverId: string;
    start: string;
    end: string;
    status: BookingStatus;
    kind: BookingKind;
  };
}

/** One ticket with the booking it's about, for its detail page. */
export interface SupportTicketDetail {
  id: string;
  bookingId: string;
  createdBy: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  creatorRole: TicketCreatorRole;
  parkingSpotId: string;
  parkingSpotTitle: string;
  driverId: string;
  ownerId: string;
  bookingStart: string;
  bookingEnd: string;
  bookingStatus: BookingStatus;
  bookingKind: BookingKind;
  /** Centavos. */
  bookingAmount: number;
  paymentId: string | null;
}

export interface SupportTicketMessage {
  id: string;
  senderId: string;
  /** Sent by ParkLink staff (from this panel). */
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Admin tools: bookings, reviews, reports, payments, metrics, audit, announcements
// ---------------------------------------------------------------------------

/** A booking as the admin panel loads it by id (GET /admin/bookings/{id}). Amounts in centavos. */
export interface AdminBooking {
  id: string;
  parkingSpotId: string;
  userId: string;
  start: string;
  end: string;
  status: BookingStatus;
  kind: BookingKind;
  amount: number;
  ownerAmount: number | null;
  refundedAmount: number;
  paymentId: string | null;
  paidAt: string | null;
  cancellationReason: string | null;
  adminNote: string | null;
  verificationReview: string | null;
  verifiedAt: string | null;
  vehiclePlate: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBookingFilters {
  q?: string;
  status?: BookingStatus | '';
  spotId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface BookingChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  bookingId: string;
  reviewerId: string;
  targetType: 'spot' | 'owner' | 'driver';
  targetId: string;
  rating: number;
  comment: string;
  createdAt: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
}

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';
export type ReportTargetType = 'spot' | 'user' | 'review';

export interface UserReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string;
  status: ReportStatus;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** A Mercado Pago payment, as payment-service records it. Amounts in pesos. */
export interface AdminPayment {
  paymentId: string;
  bookingId: string | null;
  amount: number;
  refundedAmount: number;
  currency: string;
  status: string;
  payerEmail: string | null;
  approvedAt: string | null;
  createdAt: string;
  bookingStatus: BookingStatus | null;
  /** Approved by Mercado Pago but the booking isn't paid on ParkLink's side. */
  needsAttention: boolean;
}

/** The dashboard's numbers for the last `days` days. Amounts in centavos. */
export interface AdminMetrics {
  days: number;
  paidBookings: number;
  grossAmount: number;
  commission: number;
  refunded: number;
  statusCounts: Partial<Record<BookingStatus, number>>;
  daily: { date: string; paid: number; amount: number }[];
}

export interface PayoutInfoChange {
  id: string;
  previousCbu: string | null;
  cbu: string | null;
  previousTitular: string | null;
  titular: string | null;
  previousCuil: string | null;
  cuil: string | null;
  changedAt: string;
}

export interface AuditEntry {
  id: string;
  adminId: string | null;
  adminUsername: string | null;
  method: string;
  path: string;
  statusCode: number;
  summary: string | null;
  createdAt: string;
}

export type BroadcastAudience = 'all' | 'drivers' | 'owners';

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  audience: BroadcastAudience;
  recipients: number;
  createdAt: string;
}
