// Every amount the backend sends (bookings, payouts) is in centavos -- same
// convention as mobile (see mobile/src/services/ownerBookings.ts,
// mobile/app/(driver)/bookings/[id].tsx: `amount / 100`).
export function formatCentavos(centavos: number): string {
  const pesos = centavos / 100;
  return `$${pesos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
