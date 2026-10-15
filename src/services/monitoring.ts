import * as Sentry from '@sentry/react';

// Error reports from the panel, sent to Sentry. EXPO_PUBLIC_SENTRY_DSN says where; without it
// nothing is sent (local development, or before the Sentry project exists).
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initMonitoring(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0,
  });
}

/** Ties the reports to the admin who was logged in (their username), or clears it. */
export function setMonitoringUser(username: string | null | undefined): void {
  if (!DSN) return;
  Sentry.setUser(username ? { username } : null);
}

export const ErrorBoundary = Sentry.ErrorBoundary;
