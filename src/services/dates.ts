// Every date the panel shows goes through these, in the same two formats as the app:
//   long  -- "14 de septiembre de 2026, 14:30" (in sentences)
//   short -- "14/09/2026" / "14/09/2026 14:30" (tables, rows, captions)
// Always on the Buenos Aires calendar and clock (ART, UTC-3, no DST), like the rest of
// the platform, whatever the browser's own time zone.

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function art(iso: string): Date {
  return new Date(new Date(iso).getTime() - 3 * 3600_000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "14/09/2026" */
export function formatShortDate(iso: string): string {
  const d = art(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "14:30" */
export function formatTime(iso: string): string {
  const d = art(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "14/09/2026 14:30" */
export function formatShortDateTime(iso: string): string {
  return `${formatShortDate(iso)} ${formatTime(iso)}`;
}

/** "14 de septiembre de 2026" */
export function formatLongDate(iso: string): string {
  const d = art(iso);
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "14 de septiembre de 2026, 14:30" */
export function formatLongDateTime(iso: string): string {
  return `${formatLongDate(iso)}, ${formatTime(iso)}`;
}
