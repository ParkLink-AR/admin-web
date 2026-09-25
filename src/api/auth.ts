import { request } from './client';
import { AdminSessionUser } from '@/src/store/useSessionStore';

interface LoginInput {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// `atob` isn't reliably available on Hermes (RN's JS engine) across all
// platforms, so this decodes base64url by hand instead of depending on it.
// Copied from mobile/src/api/auth.ts's base64UrlDecode.
function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = '';
  for (const char of normalized) {
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(6, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return decodeURIComponent(bytes.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''));
}

// Decodes a JWT payload without verifying it -- the app never trusts this for
// authorization (the backend re-verifies every request), it's only used to
// read the `sub` and `role` claims right after login, before the token is
// stored. Mirrors mobile/src/api/auth.ts's decodeJwtPayload.
function decodeJwtPayload(token: string): { sub: string; role?: string } {
  const payload = token.split('.')[1];
  return JSON.parse(base64UrlDecode(payload));
}

// Thrown when the credentials are valid but the account isn't an admin --
// distinct from ApiError so the login screen can show a specific message
// instead of a generic "wrong credentials" one.
export class NotAdminError extends Error {}

export async function login(input: LoginInput): Promise<{ user: AdminSessionUser; tokens: AuthTokens }> {
  const tokenResponse = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const tokens: AuthTokens = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresIn: tokenResponse.expires_in,
  };

  const { sub, role } = decodeJwtPayload(tokens.accessToken);
  if (role !== 'admin') {
    // Technically a valid token, but this tool is staff-only -- refuse
    // client-side and never store it.
    throw new NotAdminError('Esta cuenta no tiene permisos de administrador.');
  }

  return { user: { id: sub, email: input.email }, tokens };
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // Best-effort -- the local session is cleared regardless (see
    // useSessionStore.clearSession()), so a network error here shouldn't
    // block the admin from logging out on their end.
  }
}
