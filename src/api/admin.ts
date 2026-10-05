import { Platform } from 'react-native';
import { request, requestMultipart } from './client';
import {
  AccountType,
  AdminAccount,
  AdminAccountRole,
  AdminUserDetail,
  AdminUserSummary,
  BookingKind,
  BookingStatus,
  CommissionSettings,
  DriverBooking,
  OwnerPendingBalance,
  OwnerReceivedBooking,
  ParkingSpot,
  ParkingSpotStatus,
  Payout,
  PayoutStatus,
  Settlement,
  SettlementPayout,
  SettlementStatus,
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
