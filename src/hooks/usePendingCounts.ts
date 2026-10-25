import { createContext, useContext, useEffect, useState } from 'react';
import {
  countFailedRefunds,
  countPendingReports,
  countTicketsAwaitingReply,
  listPendingParkingSpots,
  listSettlements,
  listUnverifiedBookings,
} from '@/src/api/admin';

// How many items wait in each section that needs someone to act: the menu shows them next to
// the section and Inicio sums them up, from the same load. Each is undefined while loading and
// null if its request failed (each loads on its own, so one failing doesn't blank the rest).
export type PendingKind = 'spotReview' | 'unverified' | 'tickets' | 'reports' | 'refunds' | 'settlements';
export type PendingCount = number | null | undefined;
export type PendingCounts = Record<PendingKind, PendingCount>;

const LOADERS: Record<PendingKind, () => Promise<number>> = {
  spotReview: () => listPendingParkingSpots().then((spots) => spots.length),
  unverified: () => listUnverifiedBookings().then((bookings) => bookings.length),
  tickets: countTicketsAwaitingReply,
  reports: countPendingReports,
  refunds: countFailedRefunds,
  settlements: () => listSettlements('PENDING').then((settlements) => settlements.length),
};

const KINDS = Object.keys(LOADERS) as PendingKind[];
// Something new (a ticket, a spot to review) shows up without having to move around the panel.
const REFRESH_MS = 60_000;

const EMPTY: PendingCounts = {
  spotReview: undefined,
  unverified: undefined,
  tickets: undefined,
  reports: undefined,
  refunds: undefined,
  settlements: undefined,
};

/**
 * Loads every count, again on each navigation (`reloadKey`) -- so resolving one and moving
 * on updates it -- and every minute. A reload keeps the previous figures until the new
 * ones arrive, so the menu doesn't flicker.
 */
export function useLoadPendingCounts(enabled: boolean, reloadKey: string): PendingCounts {
  const [counts, setCounts] = useState<PendingCounts>(EMPTY);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    for (const kind of KINDS) {
      LOADERS[kind]()
        .then((count) => !cancelled && setCounts((prev) => ({ ...prev, [kind]: count })))
        .catch(() => !cancelled && setCounts((prev) => ({ ...prev, [kind]: prev[kind] ?? null })));
    }
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey, tick]);

  return counts;
}

export const PendingCountsContext = createContext<PendingCounts>(EMPTY);

/** The counts the admin layout loaded, for the screens inside it. */
export function usePendingCounts(): PendingCounts {
  return useContext(PendingCountsContext);
}
