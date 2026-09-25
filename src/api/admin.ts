import { Platform } from 'react-native';
import { request, requestMultipart } from './client';
import {
  AccountType,
  AdminUserDetail,
  AdminUserSummary,
  BookingKind,
  BookingStatus,
  CommissionSettings,
  DriverBooking,
  OwnerReceivedBooking,
  ParkingSpot,
  ParkingSpotStatus,
  Payout,
  PayoutStatus,
  UserStatus,
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
  account_type: AccountType;
  status: UserStatus;
  created_at: string;
}

interface AdminUserDetailResponse extends AdminUserSummaryResponse {
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
    accountType: u.account_type,
    status: u.status,
    createdAt: u.created_at,
  };
}

function toAdminUserDetail(u: AdminUserDetailResponse): AdminUserDetail {
  return {
    ...toAdminUserSummary(u),
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

// parking-service is NestJS -- already camelCase, no mapping needed. Note:
// this endpoint (parking-spots.service.ts's findAllByOwner) excludes DELETED
// spots but includes ACTIVE and PAUSED, so a deleted spot won't show up here
// even for an admin. See the report for this deviation.
export async function getUserParkingSpots(userId: string): Promise<ParkingSpot[]> {
  return request<ParkingSpotResponse[]>(`/users/${userId}/parking-spots`);
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
// Payouts (booking-service, ADMIN, via gateway)
// -------------------------

interface PayoutResponse {
  id: string;
  booking_id: string;
  owner_id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: PayoutStatus;
  paid_at?: string | null;
  paid_by_admin_id?: string | null;
  proof_url?: string | null;
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
    createdAt: p.created_at,
  };
}

export async function listPayouts(status?: PayoutStatus): Promise<Payout[]> {
  const path = status ? `/admin/payouts?status=${status.toLowerCase()}` : '/admin/payouts';
  const response = await request<PayoutResponse[]>(path);
  return response.map(toPayout);
}

export async function getPayout(payoutId: string): Promise<Payout> {
  const response = await request<PayoutResponse>(`/admin/payouts/${payoutId}`);
  return toPayout(response);
}

export interface ProofAsset {
  uri: string;
  name: string;
  type: string;
}

// The admin's user id comes from their JWT (the gateway injects X-User-Id
// server-side) -- nothing else is sent besides the optional proof photo.
// FormData built the same web-vs-native way as
// mobile/src/api/auth.ts's uploadAvatar().
export async function markPayoutPaid(payoutId: string, proof?: ProofAsset): Promise<Payout> {
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
  const response = await requestMultipart<PayoutResponse>(`/admin/payouts/${payoutId}/mark-paid`, formData);
  return toPayout(response);
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
