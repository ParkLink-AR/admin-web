# ParkLink Admin

Staff-only internal tool for customer support and manual owner payouts. It's
an Expo Router app, independent from (but styled to match) the driver/owner
`mobile` app, talking to the same backend through the gateway.

Unlike `mobile`, which is phone-first, this app is built primarily for a PC
browser: it opens with a persistent left sidebar and multi-column/master-detail
layouts on wide windows, falling back to a stacked, single-column layout on a
narrow window or an actual phone browser.

The UI is Spanish-only (no i18n layer) since it's only ever used by ParkLink
staff.

## What it does

- **Buscar usuarios**: look up a user by name/email/phone, see their profile,
  verification status, payout info (CBU/titular/CUIL), the parking spots they
  own, the bookings they made as a driver, and (if they're an owner) the
  bookings they received.
- **Pagos pendientes**: list pending/paid owner payouts, see the
  gross/commission/net breakdown for one, and mark it as paid (optionally
  attaching a photo of the transfer receipt).
- **Configuración**: view and update the platform's commission percentage.

## Running it

```bash
npm install
cp .env.example .env   # then edit EXPO_PUBLIC_API_URL if needed
npx expo start --web   # or --ios / --android
```

`EXPO_PUBLIC_API_URL` points at the ParkLink gateway (same convention as
`mobile`) and defaults to `http://localhost:8080` if unset.

## Logging in

Login goes through the same `POST /auth/login` as every other ParkLink app,
but this app additionally decodes the returned access token and refuses to
sign in (client-side) unless its `role` claim is `"admin"`. For an account to
be able to log in here, it needs `is_admin=true` set on its row in
auth-service's `users` table -- there's no self-serve way to become an admin
from any app.

## Structure

- `app/` -- Expo Router routes: `(auth)/login`, and the `(admin)` group
  (`home`, `users`, `users/[id]`, `payouts`, `payouts/[id]`, `settings`),
  wrapped in a sidebar/responsive shell in `app/(admin)/_layout.tsx`.
- `src/api/` -- fetch wrapper (`client.ts`, mirrors `mobile/src/api/client.ts`'s
  `ApiError`/refresh-retry logic), auth (`auth.ts`), and every admin endpoint
  (`admin.ts`).
- `src/components/` -- shared UI (`Screen`, `Card`, `Button`, `Badge`,
  `PageHeader`, and `PayoutDetailPanel`, which is reused by both the payout
  detail route and the desktop master-detail pane).
- `src/store/useSessionStore.ts` -- session (tokens + user), persisted via
  `expo-secure-store` (mirrors `mobile`'s `useSessionStore`/`secureStorage`).
- `src/theme/`, `src/types/`, `src/services/money.ts` -- palette (matches
  `mobile`'s light theme), wire types, and centavos-to-pesos formatting.
