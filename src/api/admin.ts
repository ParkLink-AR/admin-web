import { Platform } from 'react-native';
import { request, requestMultipart } from './client';
import {
  AccountClosureSummary,
  AccountType,
  AdminAccount,
  AdminAccountRole,
  AdminUserDetail,
  AdminUserSummary,
  AdminBooking,
  AdminBookingFilters,
  AdminMetrics,
  AdminPayment,
  AdminReview,
  AuditEntry,
  BookingChatMessage,
  Broadcast,
  BroadcastAudience,
  PayoutInfoChange,
  ReportStatus,
  UserReport,
  BookingKind,
  BookingStatus,
  CommissionSettings,
  DriverBooking,
  FailedRefund,
  OwnerPendingBalance,
  OwnerReceivedBooking,
  ParkingSpot,
  ParkingSpotStatus,
  RefundErrorCode,
  RefundResolution,
  SpotReviewDecision,
  Payout,
  PayoutStatus,
  Settlement,
  SettlementPayout,
  SettlementStatus,
  SupportTicketDetail,
  SupportTicketMessage,
  SupportTicketSummary,
  TicketCreatorRole,
  TicketStatus,
  UnverifiedBooking,
  UserStatus,
  VerificationReviewDecision,
} from '@/src/types';

// -------------------------
// Users (auth-service, via gateway)
// -------------------------

interface AdminUserSummaryResponse {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  dni: string | null;
  account_type: AccountType;
  status: UserStatus;
  created_at: string;
}

interface AdminUserDetailResponse extends AdminUserSummaryResponse {
  dni: string | null;
  avatar_url: string | null;
  cbu: string | null;
  payout_titular: string | null;
  cuil: string | null;
  has_payout_info: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  last_login_at: string | null;
  suspended_at: string | null;
  suspended_by_admin_id: string | null;
  suspension_reason: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
  deletion_requested_by_admin_id: string | null;
  deletion_reason: string | null;
  deleted_at: string | null;
}

function toAdminUserSummary(u: AdminUserSummaryResponse): AdminUserSummary {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    firstName: u.first_name,
    lastName: u.last_name,
    dni: u.dni,
    accountType: u.account_type,
    status: u.status,
    createdAt: u.created_at,
  };
}

function toAdminUserDetail(u: AdminUserDetailResponse): AdminUserDetail {
  return {
    ...toAdminUserSummary(u),
    dni: u.dni,
    avatarUrl: u.avatar_url,
    cbu: u.cbu,
    payoutTitular: u.payout_titular,
    cuil: u.cuil,
    hasPayoutInfo: u.has_payout_info,
    emailVerified: u.email_verified,
    phoneVerified: u.phone_verified,
    lastLoginAt: u.last_login_at,
    suspendedAt: u.suspended_at,
    suspendedByAdminId: u.suspended_by_admin_id,
    suspensionReason: u.suspension_reason,
    deletionRequestedAt: u.deletion_requested_at,
    deletionScheduledAt: u.deletion_scheduled_at,
    deletionRequestedByAdminId: u.deletion_requested_by_admin_id,
    deletionReason: u.deletion_reason,
    deletedAt: u.deleted_at,
  };
}

// `query` is required (min length 1) -- the caller must not invoke this with
// an empty string, see app/(admin)/users/index.tsx's empty state instead.
export async function searchUsers(query: string): Promise<AdminUserSummary[]> {
  const response = await request<AdminUserSummaryResponse[]>(
    `/admin/users?query=${encodeURIComponent(query)}`
  );
  return response.map(toAdminUserSummary);
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const response = await request<AdminUserDetailResponse>(`/admin/users/${userId}`);
  return toAdminUserDetail(response);
}

// -------------------------
// Account lifecycle: suspension and deletion at the holder's request (auth-service)
// -------------------------

interface AccountClosureSummaryResponse {
  blocked: boolean;
  blocked_reason: string | null;
  in_progress_count: number;
  driver_bookings_to_cancel: number;
  owner_bookings_to_cancel: number;
  owner_requests_to_reject: number;
  pending_payout_count: number;
  pending_payout_amount: number;
  spot_count: number;
}

// What suspending or deleting the account would do -- shown before confirming.
export async function getAccountClosureSummary(userId: string): Promise<AccountClosureSummary> {
  const r = await request<AccountClosureSummaryResponse>(`/admin/users/${userId}/closure-summary`);
  return {
    blocked: r.blocked,
    blockedReason: r.blocked_reason,
    inProgressCount: r.in_progress_count,
    driverBookingsToCancel: r.driver_bookings_to_cancel,
    ownerBookingsToCancel: r.owner_bookings_to_cancel,
    ownerRequestsToReject: r.owner_requests_to_reject,
    pendingPayoutCount: r.pending_payout_count,
    pendingPayoutAmount: r.pending_payout_amount,
    spotCount: r.spot_count,
  };
}

export async function suspendUser(userId: string, reason: string): Promise<AdminUserDetail> {
  const response = await request<AdminUserDetailResponse>(`/admin/users/${userId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return toAdminUserDetail(response);
}

// The only way out of a suspension.
export async function reactivateUser(userId: string): Promise<AdminUserDetail> {
  const response = await request<AdminUserDetailResponse>(`/admin/users/${userId}/reactivate`, { method: 'POST' });
  return toAdminUserDetail(response);
}

// Deletes the account because its holder asked for it outside the app (by email, etc.):
// personal data wiped right away, or as soon as ParkLink has paid the owner what it owes.
export async function deleteUserAtHoldersRequest(userId: string, reason: string): Promise<AdminUserDetail> {
  const response = await request<AdminUserDetailResponse>(`/admin/users/${userId}/deletion`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return toAdminUserDetail(response);
}

// -------------------------
// A user's spots & bookings (reused non-admin endpoints -- an admin's own
// valid JWT is enough, these aren't ownership-gated by the caller)
// -------------------------

interface ParkingSpotResponse {
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
  verificationPhotos: string[];
  reviewNotes: string | null;
  status: ParkingSpotStatus;
  createdAt: string;
  updatedAt: string;
  rating: number | null;
  reviewCount: number;
}

// parking-service is NestJS -- already camelCase, no mapping needed.
// includeDeleted=true is admin-only -- the owner's own app never passes it, so a spot the
// owner deleted keeps showing up here (marked ELIMINADA via SpotStatusBadge) for support.
export async function getUserParkingSpots(userId: string): Promise<ParkingSpot[]> {
  return request<ParkingSpotResponse[]>(`/users/${userId}/parking-spots?includeDeleted=true`);
}

// Single-spot lookup for the admin spot-detail screen -- parking-service's GET
// /parking-spots/{id} is PUBLIC (same one the driver app uses), so this needs no admin
// gate, just a valid bearer token like every other request this app makes.
export async function getParkingSpotById(spotId: string): Promise<ParkingSpot> {
  return request<ParkingSpotResponse>(`/parking-spots/${spotId}`);
}

// Cola de revisión de cocheras nuevas: todas las que siguen en pending_review, las más viejas
// primero. A diferencia de GET /parking-spots/{id}, esta ruta sí es admin-only (el gateway
// exige role:admin) y devuelve también verificationPhotos.
export async function listPendingParkingSpots(): Promise<ParkingSpot[]> {
  return request<ParkingSpotResponse[]>('/admin/parking-spots');
}

// Una cochera sólo se puede revisar una vez (un segundo intento da 409). Rechazar necesita
// motivo: es lo que el dueño ve en la app para saber qué corregir.
export async function reviewParkingSpot(spotId: string, decision: SpotReviewDecision, notes?: string): Promise<ParkingSpot> {
  return request<ParkingSpotResponse>(`/admin/parking-spots/${spotId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, ...(notes ? { notes } : {}) }),
  });
}

interface DriverBookingResponse {
  id: string;
  parking_spot_id: string;
  user_id: string;
  start: string;
  end: string;
  status: BookingStatus;
  hold_expires_at?: string | null;
  amount: number;
  payment_id?: string | null;
  paid_at?: string | null;
  cancellation_reason?: string | null;
  kind: BookingKind;
  verification_code?: string | null;
  verified_at?: string | null;
  updated_at: string;
}

function toDriverBooking(b: DriverBookingResponse): DriverBooking {
  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    userId: b.user_id,
    start: b.start,
    end: b.end,
    status: b.status,
    holdExpiresAt: b.hold_expires_at ?? null,
    amount: b.amount,
    paymentId: b.payment_id ?? null,
    paidAt: b.paid_at ?? null,
    cancellationReason: b.cancellation_reason ?? null,
    kind: b.kind,
    verificationCode: b.verification_code ?? null,
    verifiedAt: b.verified_at ?? null,
    updatedAt: b.updated_at,
  };
}

// "Bookings this user made as a driver."
export async function getUserBookingHistory(userId: string): Promise<DriverBooking[]> {
  const response = await request<DriverBookingResponse[]>(`/users/${userId}/bookings/history`);
  return response.map(toDriverBooking);
}

interface OwnerReceivedBookingResponse {
  id: string;
  parking_spot_id: string;
  user_id: string;
  start: string;
  end: string;
  status: BookingStatus;
  amount: number;
  payment_id?: string | null;
  paid_at?: string | null;
  cancellation_reason?: string | null;
  kind: BookingKind;
  updated_at: string;
}

function toOwnerReceivedBooking(b: OwnerReceivedBookingResponse): OwnerReceivedBooking {
  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    userId: b.user_id,
    start: b.start,
    end: b.end,
    status: b.status,
    amount: b.amount,
    paymentId: b.payment_id ?? null,
    paidAt: b.paid_at ?? null,
    cancellationReason: b.cancellation_reason ?? null,
    kind: b.kind,
    updatedAt: b.updated_at,
  };
}

// "Bookings received across every spot this user owns" -- only relevant when
// account_type is OWNER or BOTH, see the "Reservas recibidas" tab.
export async function getOwnerReceivedBookings(ownerId: string): Promise<OwnerReceivedBooking[]> {
  const response = await request<OwnerReceivedBookingResponse[]>(`/admin/owners/${ownerId}/bookings`);
  return response.map(toOwnerReceivedBooking);
}

// -------------------------
// Unverified bookings (booking-service, ADMIN, via gateway)
// -------------------------

interface UnverifiedBookingResponse {
  id: string;
  parking_spot_id: string;
  user_id: string;
  start: string;
  end: string;
  kind: BookingKind;
  amount: number;
  owner_amount?: number | null;
  payment_id?: string | null;
  paid_at?: string | null;
  vehicle?: { plate: string } | null;
}

function toUnverifiedBooking(b: UnverifiedBookingResponse): UnverifiedBooking {
  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    userId: b.user_id,
    start: b.start,
    end: b.end,
    kind: b.kind,
    amount: b.amount,
    ownerAmount: b.owner_amount ?? null,
    paymentId: b.payment_id ?? null,
    paidAt: b.paid_at ?? null,
    vehiclePlate: b.vehicle?.plate ?? null,
  };
}

// Paid bookings that completed without their arrival code ever being verified -- the
// owner's payout for each waits on resolveVerificationReview below.
export async function listUnverifiedBookings(): Promise<UnverifiedBooking[]> {
  const response = await request<UnverifiedBookingResponse[]>('/admin/bookings/unverified');
  return response.map(toUnverifiedBooking);
}

// APPROVED releases the owner's payout; REFUNDED refunds the driver through Mercado Pago
// and the owner is never paid for it.
export async function resolveVerificationReview(bookingId: string, decision: VerificationReviewDecision): Promise<void> {
  await request(`/admin/bookings/${bookingId}/verification-review`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

// -------------------------
// Failed refunds (payment-service, ADMIN, via gateway)
//
// Refunds Mercado Pago refused when a paid booking was called off. payment-service keeps
// retrying the passing failures on its own; these are what's still owed, until an admin
// retries it, marks it as returned some other way, or discards it (e.g. test data).
// -------------------------

interface FailedRefundResponse {
  paymentId: string;
  bookingId: string | null;
  amount: number;
  payerEmail: string | null;
  approvedAt: string | null;
  attempts: number;
  retriesExhausted: boolean;
  errorCode: RefundErrorCode | null;
  lastError: string | null;
  failedAt: string;
  booking: {
    id: string;
    user_id: string;
    parking_spot_id?: string;
    status: BookingStatus;
    kind?: BookingKind;
    start?: string;
    end?: string;
    amount: number;
    cancellation_reason?: string | null;
  } | null;
}

function toFailedRefund(r: FailedRefundResponse): FailedRefund {
  const b = r.booking;
  return {
    ...r,
    booking: b && b.parking_spot_id && b.start && b.end
      ? {
          id: b.id,
          userId: b.user_id,
          parkingSpotId: b.parking_spot_id,
          status: b.status,
          kind: b.kind ?? 'HOURLY',
          start: b.start,
          end: b.end,
          amount: b.amount,
          cancellationReason: b.cancellation_reason ?? null,
        }
      : null,
  };
}

export async function listFailedRefunds(): Promise<FailedRefund[]> {
  const response = await request<{ items: FailedRefundResponse[] }>('/admin/refunds');
  return response.items.map(toFailedRefund);
}

export async function countFailedRefunds(): Promise<number> {
  const response = await request<{ count: number }>('/admin/refunds/count');
  return response.count;
}

/** Asks Mercado Pago for the refund again, right now. Throws (ApiError) if it fails again. */
export async function retryFailedRefund(paymentId: string): Promise<void> {
  await request(`/admin/refunds/${encodeURIComponent(paymentId)}/retry`, { method: 'POST' });
}

/** Closes a failed refund by hand. `note` is required to discard one. */
export async function resolveFailedRefund(paymentId: string, resolution: RefundResolution, note: string): Promise<void> {
  await request(`/admin/refunds/${encodeURIComponent(paymentId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution, note }),
  });
}

// -------------------------
// Payouts & Settlements (booking-service, ADMIN, via gateway)
//
// Individual booking payouts still accumulate automatically and unattached
// (not yet drafted into a Settlement) ones can be listed per-owner, but
// paying an owner is no longer a per-payout action: an admin drafts a
// Settlement (freezes every currently-pending payout for that owner), then
// confirms it once the real bank transfer went out (optionally attaching a
// proof photo), or cancels the draft to release its payouts back to
// unattached. There is no more per-payout mark-paid endpoint.
// -------------------------

interface PayoutResponse {
  id: string;
  booking_id: string;
  owner_id: string;
  payment_id?: string | null;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: PayoutStatus;
  paid_at?: string | null;
  paid_by_admin_id?: string | null;
  proof_url?: string | null;
  settlement_id?: string | null;
  created_at: string;
}

function toPayout(p: PayoutResponse): Payout {
  return {
    id: p.id,
    bookingId: p.booking_id,
    ownerId: p.owner_id,
    grossAmount: p.gross_amount,
    commissionAmount: p.commission_amount,
    netAmount: p.net_amount,
    status: p.status,
    paidAt: p.paid_at ?? null,
    paidByAdminId: p.paid_by_admin_id ?? null,
    proofUrl: p.proof_url ?? null,
    settlementId: p.settlement_id ?? null,
    createdAt: p.created_at,
  };
}

interface OwnerPendingBalanceResponse {
  owner_id: string;
  pending_net_amount: number;
  pending_count: number;
  oldest_pending_at: string;
}

function toOwnerPendingBalance(b: OwnerPendingBalanceResponse): OwnerPendingBalance {
  return {
    ownerId: b.owner_id,
    pendingNetAmount: b.pending_net_amount,
    pendingCount: b.pending_count,
    oldestPendingAt: b.oldest_pending_at,
  };
}

// "Who do I owe money to" -- one row per owner with at least one unattached pending
// payout. The starting screen for the whole payouts flow.
export async function getOwnerPendingBalances(): Promise<OwnerPendingBalance[]> {
  const response = await request<OwnerPendingBalanceResponse[]>('/admin/owners/pending-balances');
  return response.map(toOwnerPendingBalance);
}

// The individual bookings making up one owner's pending balance, shown before drafting
// a settlement so the admin can see exactly what they're about to freeze.
export async function getOwnerPendingPayouts(ownerId: string): Promise<Payout[]> {
  const response = await request<PayoutResponse[]>(
    `/admin/payouts?status=pending&owner_id=${ownerId}`
  );
  return response.map(toPayout);
}

interface SettlementPayoutResponse {
  id: string;
  booking_id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
}

function toSettlementPayout(p: SettlementPayoutResponse): SettlementPayout {
  return {
    id: p.id,
    bookingId: p.booking_id,
    grossAmount: p.gross_amount,
    commissionAmount: p.commission_amount,
    netAmount: p.net_amount,
  };
}

interface SettlementResponse {
  id: string;
  owner_id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: SettlementStatus;
  proof_url: string | null;
  paid_at: string | null;
  paid_by_admin_id: string | null;
  created_by_admin_id: string;
  created_at: string;
  payouts?: SettlementPayoutResponse[];
}

function toSettlement(s: SettlementResponse): Settlement {
  return {
    id: s.id,
    ownerId: s.owner_id,
    grossAmount: s.gross_amount,
    commissionAmount: s.commission_amount,
    netAmount: s.net_amount,
    status: s.status,
    proofUrl: s.proof_url,
    paidAt: s.paid_at,
    paidByAdminId: s.paid_by_admin_id,
    createdByAdminId: s.created_by_admin_id,
    createdAt: s.created_at,
    payouts: s.payouts?.map(toSettlementPayout),
  };
}

// Phase 1, "draft": freezes every currently-pending payout for this owner into a new
// PENDING Settlement. Plain POST, no body. 400 NOTHING_TO_SETTLE if the owner has none
// (e.g. another admin drafted one moments earlier).
export async function draftSettlement(ownerId: string): Promise<Settlement> {
  const response = await request<SettlementResponse>(`/admin/owners/${ownerId}/settlements`, {
    method: 'POST',
  });
  return toSettlement(response);
}

export interface ProofAsset {
  uri: string;
  name: string;
  type: string;
}

// Phase 2, "confirm": asserts the bank transfer actually went out. The admin's user id
// comes from their JWT (the gateway injects X-User-Id server-side) -- nothing else is
// sent besides the optional proof photo. FormData built the same web-vs-native way as
// mobile/src/api/auth.ts's uploadAvatar() (carried over from the old per-payout
// mark-paid flow this replaces).
export async function confirmSettlement(settlementId: string, proof?: ProofAsset): Promise<Settlement> {
  const formData = new FormData();
  if (proof) {
    if (Platform.OS === 'web') {
      // react-native-web's FormData is the browser's real implementation,
      // which has no idea what to do with RN's {uri, name, type} object --
      // it just stringifies it, so the actual file bytes have to be fetched
      // into a real Blob first.
      const blob = await (await fetch(proof.uri)).blob();
      formData.append('proof', blob, proof.name);
    } else {
      // On native, this {uri, name, type} shape is exactly what RN's bridge
      // expects and turns into a proper multipart file part.
      formData.append('proof', {
        uri: proof.uri,
        name: proof.name,
        type: proof.type,
      } as unknown as Blob);
    }
  }
  const response = await requestMultipart<SettlementResponse>(
    `/admin/settlements/${settlementId}/confirm`,
    formData
  );
  return toSettlement(response);
}

// Undoes a mistaken draft before confirmation -- releases its payouts back to
// unattached (they reappear in getOwnerPendingBalances) and removes the draft. 204 on
// success.
export async function cancelSettlement(settlementId: string): Promise<void> {
  await request<void>(`/admin/settlements/${settlementId}/cancel`, { method: 'POST' });
}

export async function listSettlements(status?: SettlementStatus): Promise<Settlement[]> {
  const path = status ? `/admin/settlements?status=${status.toLowerCase()}` : '/admin/settlements';
  const response = await request<SettlementResponse[]>(path);
  return response.map(toSettlement);
}

export async function getSettlement(settlementId: string): Promise<Settlement> {
  const response = await request<SettlementResponse>(`/admin/settlements/${settlementId}`);
  return toSettlement(response);
}

// -------------------------
// Commission settings (booking-service, ADMIN)
// -------------------------

export async function getCommissionSettings(): Promise<CommissionSettings> {
  const response = await request<{ commission_rate_bp: number; commission_rate_percent: number }>(
    '/admin/settings/commission'
  );
  return { commissionRateBp: response.commission_rate_bp, commissionRatePercent: response.commission_rate_percent };
}

export async function updateCommissionSettings(commissionRateBp: number): Promise<CommissionSettings> {
  const response = await request<{ commission_rate_bp: number; commission_rate_percent: number }>(
    '/admin/settings/commission',
    { method: 'PUT', body: JSON.stringify({ commission_rate_bp: commissionRateBp }) }
  );
  return { commissionRateBp: response.commission_rate_bp, commissionRatePercent: response.commission_rate_percent };
}

// -------------------------
// Admin accounts (auth-service, SUPERADMIN-only, via gateway) -- the admin
// identity system itself, separate from the regular `users` table above.
// -------------------------

interface AdminAccountResponse {
  id: string;
  username: string;
  role: AdminAccountRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

function toAdminAccount(a: AdminAccountResponse): AdminAccount {
  return {
    id: a.id,
    username: a.username,
    role: a.role,
    isActive: a.is_active,
    createdAt: a.created_at,
    lastLoginAt: a.last_login_at,
  };
}

// No superadmin gate on this one (see auth-service's get_admin_account) -- any admin can
// resolve another admin id's username, e.g. a settlement's "creado por"/"pagado por".
export async function getAdminAccount(id: string): Promise<AdminAccount> {
  const response = await request<AdminAccountResponse>(`/admin/accounts/${id}`);
  return toAdminAccount(response);
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const response = await request<AdminAccountResponse[]>('/admin/accounts');
  return response.map(toAdminAccount);
}

export interface CreateAdminAccountInput {
  username: string;
  password: string;
  role: AdminAccountRole;
}

export async function createAdminAccount(input: CreateAdminAccountInput): Promise<AdminAccount> {
  const response = await request<AdminAccountResponse>('/admin/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toAdminAccount(response);
}

export async function setAdminAccountActive(id: string, isActive: boolean): Promise<AdminAccount> {
  const response = await request<AdminAccountResponse>(`/admin/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
  return toAdminAccount(response);
}

// SUPERADMIN-only, same as the rest of /admin/accounts/* -- there's no self-service
// "forgot password" for this separate staff identity system, so a superadmin sets a new
// password for a locked-out admin instead.
export async function setAdminAccountPassword(id: string, newPassword: string): Promise<AdminAccount> {
  const response = await request<AdminAccountResponse>(`/admin/accounts/${id}/password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
  return toAdminAccount(response);
}

// ---------------------------------------------------------------------------
// Support tickets (booking-service, ADMIN, via gateway)
// ---------------------------------------------------------------------------
// Tickets drivers and owners open from a booking in the app. Staff reply here; the user
// gets a push and sees the reply in the app.

interface TicketSummaryResponse {
  id: string;
  booking_id: string;
  created_by: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  creator_role: TicketCreatorRole;
  last_message_at?: string;
  last_message_from: 'user' | 'staff';
  awaiting_reply: boolean;
  booking: {
    parking_spot_id: string;
    driver_id: string;
    start: string;
    end: string;
    status: BookingStatus;
    kind: BookingKind;
  };
}

function toTicketSummary(t: TicketSummaryResponse): SupportTicketSummary {
  return {
    id: t.id,
    bookingId: t.booking_id,
    createdBy: t.created_by,
    subject: t.subject,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    creatorRole: t.creator_role,
    lastMessageAt: t.last_message_at ?? null,
    lastMessageFrom: t.last_message_from,
    awaitingReply: t.awaiting_reply,
    booking: {
      parkingSpotId: t.booking.parking_spot_id,
      driverId: t.booking.driver_id,
      start: t.booking.start,
      end: t.booking.end,
      status: t.booking.status,
      kind: t.booking.kind,
    },
  };
}

export async function listSupportTickets(status?: TicketStatus): Promise<SupportTicketSummary[]> {
  const rows = await request<TicketSummaryResponse[]>(`/admin/tickets${status ? `?status=${status}` : ''}`);
  return rows.map(toTicketSummary);
}

/** How many tickets wait on a reply from ParkLink -- the menu's count. */
export async function countTicketsAwaitingReply(): Promise<number> {
  const rows = await listSupportTickets();
  return rows.filter((t) => t.awaitingReply).length;
}

interface TicketDetailResponse {
  id: string;
  booking_id: string;
  created_by: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  creator_role: TicketCreatorRole;
  parking_spot_id: string;
  parking_spot_title: string;
  driver_id: string;
  owner_id: string;
  booking_start: string;
  booking_end: string;
  booking_status: BookingStatus;
  booking_kind: BookingKind;
  booking_amount: number;
  payment_id?: string;
}

export async function getSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
  const t = await request<TicketDetailResponse>(`/admin/tickets/${encodeURIComponent(ticketId)}`);
  return {
    id: t.id,
    bookingId: t.booking_id,
    createdBy: t.created_by,
    subject: t.subject,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    creatorRole: t.creator_role,
    parkingSpotId: t.parking_spot_id,
    parkingSpotTitle: t.parking_spot_title,
    driverId: t.driver_id,
    ownerId: t.owner_id,
    bookingStart: t.booking_start,
    bookingEnd: t.booking_end,
    bookingStatus: t.booking_status,
    bookingKind: t.booking_kind,
    bookingAmount: t.booking_amount,
    paymentId: t.payment_id ?? null,
  };
}

interface TicketMessageResponse {
  id: string;
  sender_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

function toTicketMessage(m: TicketMessageResponse): SupportTicketMessage {
  return { id: m.id, senderId: m.sender_id, isAdmin: m.is_admin, body: m.body, createdAt: m.created_at };
}

export async function listSupportTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  const rows = await request<TicketMessageResponse[]>(`/admin/tickets/${encodeURIComponent(ticketId)}/messages`);
  return rows.map(toTicketMessage);
}

/** Replies as ParkLink. An OPEN ticket moves to IN_PROGRESS on its own. */
export async function replySupportTicket(ticketId: string, body: string): Promise<SupportTicketMessage> {
  const m = await request<TicketMessageResponse>(`/admin/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return toTicketMessage(m);
}

export async function updateSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await request(`/admin/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Bookings (booking-service, ADMIN): search, detail, cancel/refund, chat
// ---------------------------------------------------------------------------

interface AdminBookingResponse {
  id: string;
  parking_spot_id: string;
  user_id: string;
  start: string;
  end: string;
  status: BookingStatus;
  kind: BookingKind;
  amount: number;
  owner_amount?: number;
  refunded_amount: number;
  payment_id?: string;
  paid_at?: string;
  cancellation_reason?: string;
  admin_note?: string;
  verification_review?: string;
  verified_at?: string;
  vehicle_plate?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_type?: string;
  created_at: string;
  updated_at: string;
}

function toAdminBooking(b: AdminBookingResponse): AdminBooking {
  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    userId: b.user_id,
    start: b.start,
    end: b.end,
    status: b.status,
    kind: b.kind,
    amount: b.amount,
    ownerAmount: b.owner_amount ?? null,
    refundedAmount: b.refunded_amount,
    paymentId: b.payment_id ?? null,
    paidAt: b.paid_at ?? null,
    cancellationReason: b.cancellation_reason ?? null,
    adminNote: b.admin_note ?? null,
    verificationReview: b.verification_review ?? null,
    verifiedAt: b.verified_at ?? null,
    vehiclePlate: b.vehicle_plate ?? null,
    vehicleBrand: b.vehicle_brand ?? null,
    vehicleModel: b.vehicle_model ?? null,
    vehicleType: b.vehicle_type ?? null,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

export async function searchBookings(filters: AdminBookingFilters): Promise<{ items: AdminBooking[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.spotId) params.set('spot_id', filters.spotId);
  if (filters.userId) params.set('user_id', filters.userId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));
  const res = await request<{ items: AdminBookingResponse[]; total: number }>(`/admin/bookings?${params.toString()}`);
  return { items: res.items.map(toAdminBooking), total: res.total };
}

export async function getAdminBooking(bookingId: string): Promise<AdminBooking> {
  return toAdminBooking(await request<AdminBookingResponse>(`/admin/bookings/${encodeURIComponent(bookingId)}`));
}

export async function getBookingChat(bookingId: string): Promise<BookingChatMessage[]> {
  const rows = await request<{ id: string; sender_id: string; body: string; created_at: string }[]>(
    `/admin/bookings/${encodeURIComponent(bookingId)}/messages`,
  );
  return rows.map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
}

/** Cancels on ParkLink's behalf. refundAmount in centavos; omitted = all of it. */
export async function adminCancelBooking(bookingId: string, note: string, refundAmount?: number): Promise<AdminBooking> {
  return toAdminBooking(
    await request<AdminBookingResponse>(`/admin/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ note, ...(refundAmount !== undefined ? { refund_amount: refundAmount } : {}) }),
    }),
  );
}

/** Refunds (part of) a finished booking. amount in centavos. */
export async function adminRefundBooking(
  bookingId: string, amount: number, note: string,
): Promise<{ booking: AdminBooking; absorbedByParkLink: boolean }> {
  const res = await request<{ booking: AdminBookingResponse; absorbed_by_parklink: boolean }>(
    `/admin/bookings/${encodeURIComponent(bookingId)}/refund`,
    { method: 'POST', body: JSON.stringify({ amount, note }) },
  );
  return { booking: toAdminBooking(res.booking), absorbedByParkLink: res.absorbed_by_parklink };
}

// ---------------------------------------------------------------------------
// Reviews moderation, reports, metrics (booking-service, ADMIN)
// ---------------------------------------------------------------------------

export async function listAdminReviews(hidden?: boolean): Promise<AdminReview[]> {
  const query = hidden === undefined ? '' : `?hidden=${hidden}`;
  const rows = await request<{
    id: string; booking_id: string; reviewer_id: string; target_type: AdminReview['targetType'];
    target_id: string; rating: number; comment: string; created_at: string; hidden_at?: string; hidden_reason?: string;
  }[]>(`/admin/reviews${query}`);
  return rows.map((r) => ({
    id: r.id, bookingId: r.booking_id, reviewerId: r.reviewer_id, targetType: r.target_type, targetId: r.target_id,
    rating: r.rating, comment: r.comment, createdAt: r.created_at, hiddenAt: r.hidden_at ?? null, hiddenReason: r.hidden_reason ?? null,
  }));
}

export async function hideReview(reviewId: string, reason: string): Promise<void> {
  await request(`/admin/reviews/${encodeURIComponent(reviewId)}/hide`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function restoreReview(reviewId: string): Promise<void> {
  await request(`/admin/reviews/${encodeURIComponent(reviewId)}/restore`, { method: 'POST' });
}

interface ReportResponse {
  id: string; reporter_id: string; target_type: UserReport['targetType']; target_id: string; reason: string;
  details: string; status: ReportStatus; admin_note?: string; resolved_at?: string; created_at: string;
}

function toReport(r: ReportResponse): UserReport {
  return {
    id: r.id, reporterId: r.reporter_id, targetType: r.target_type, targetId: r.target_id, reason: r.reason,
    details: r.details, status: r.status, adminNote: r.admin_note ?? null, resolvedAt: r.resolved_at ?? null, createdAt: r.created_at,
  };
}

export async function listReports(status?: ReportStatus): Promise<UserReport[]> {
  const rows = await request<ReportResponse[]>(`/admin/reports${status ? `?status=${status}` : ''}`);
  return rows.map(toReport);
}

export async function countPendingReports(): Promise<number> {
  return (await request<{ count: number }>('/admin/reports/count')).count;
}

export async function resolveReport(reportId: string, status: 'RESOLVED' | 'DISMISSED', note: string): Promise<UserReport> {
  return toReport(await request<ReportResponse>(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
    method: 'POST', body: JSON.stringify({ status, note }),
  }));
}

export async function getAdminMetrics(days = 30): Promise<AdminMetrics> {
  const r = await request<{
    days: number; paid_bookings: number; gross_amount: number; commission: number; refunded: number;
    status_counts: Record<string, number>; daily: { date: string; paid: number; amount: number }[];
  }>(`/admin/metrics?days=${days}`);
  return {
    days: r.days, paidBookings: r.paid_bookings, grossAmount: r.gross_amount, commission: r.commission,
    refunded: r.refunded, statusCounts: r.status_counts as AdminMetrics['statusCounts'], daily: r.daily,
  };
}

// ---------------------------------------------------------------------------
// Payments (payment-service), spots moderation (parking-service)
// ---------------------------------------------------------------------------

export async function listPayments(
  filters: { q?: string; status?: string; limit?: number; offset?: number },
): Promise<{ items: AdminPayment[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));
  return request<{ items: AdminPayment[]; total: number }>(`/admin/payments?${params.toString()}`);
}

/** Every spot (status 'all'), one status, or 'suspended' ones; q matches title or address. */
export async function searchParkingSpots(status: string, q: string): Promise<ParkingSpot[]> {
  const params = new URLSearchParams({ status: status || 'all' });
  if (q) params.set('q', q);
  return request<ParkingSpotResponse[]>(`/admin/parking-spots?${params.toString()}`);
}

export async function moderateParkingSpot(spotId: string, action: 'suspend' | 'restore', reason?: string): Promise<ParkingSpot> {
  return request<ParkingSpotResponse>(`/admin/parking-spots/${encodeURIComponent(spotId)}/moderation`, {
    method: 'PATCH', body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
  });
}

// ---------------------------------------------------------------------------
// Bank detail history, audit log (auth-service), announcements (notifications-service)
// ---------------------------------------------------------------------------

export async function getPayoutInfoHistory(userId: string): Promise<PayoutInfoChange[]> {
  const rows = await request<{
    id: string; previous_cbu?: string; cbu?: string; previous_titular?: string; titular?: string;
    previous_cuil?: string; cuil?: string; changed_at: string;
  }[]>(`/admin/users/${encodeURIComponent(userId)}/payout-info-history`);
  return rows.map((r) => ({
    id: r.id, previousCbu: r.previous_cbu ?? null, cbu: r.cbu ?? null, previousTitular: r.previous_titular ?? null,
    titular: r.titular ?? null, previousCuil: r.previous_cuil ?? null, cuil: r.cuil ?? null, changedAt: r.changed_at,
  }));
}

export async function getAuditLog(
  filters: { admin?: string; query?: string; limit?: number; offset?: number },
): Promise<{ items: AuditEntry[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.admin) params.set('admin', filters.admin);
  if (filters.query) params.set('query', filters.query);
  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));
  const res = await request<{ items: {
    id: string; admin_id?: string; admin_username?: string; method: string; path: string;
    status_code: number; summary?: string; created_at: string;
  }[]; total: number }>(`/admin/audit-log?${params.toString()}`);
  return {
    total: res.total,
    items: res.items.map((e) => ({
      id: e.id, adminId: e.admin_id ?? null, adminUsername: e.admin_username ?? null, method: e.method,
      path: e.path, statusCode: e.status_code, summary: e.summary ?? null, createdAt: e.created_at,
    })),
  };
}

export async function listBroadcasts(): Promise<Broadcast[]> {
  const rows = await request<{ id: string; title: string; body: string; audience: BroadcastAudience; recipients: number; created_at: string }[]>(
    '/admin/broadcasts',
  );
  return rows.map((b) => ({ id: b.id, title: b.title, body: b.body, audience: b.audience, recipients: b.recipients, createdAt: b.created_at }));
}

export async function sendBroadcast(title: string, body: string, audience: BroadcastAudience): Promise<Broadcast> {
  const b = await request<{ id: string; title: string; body: string; audience: BroadcastAudience; recipients: number; created_at: string }>(
    '/admin/broadcasts',
    { method: 'POST', body: JSON.stringify({ title, body, audience }) },
  );
  return { id: b.id, title: b.title, body: b.body, audience: b.audience, recipients: b.recipients, createdAt: b.created_at };
}
