export type AccountType = 'DRIVER' | 'OWNER' | 'BOTH';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface AdminUserSummary {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
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
}

export type ParkingSpotStatus = 'active' | 'paused' | 'deleted';

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
  createdAt: string;
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
