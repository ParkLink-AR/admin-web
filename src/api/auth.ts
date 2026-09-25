import { request } from './client';
import { AdminSessionUser, AdminRole } from '@/src/store/useSessionStore';

interface LoginInput {
  username: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Admin sessions don't rotate refresh tokens -- POST /admin/auth/login just
// returns a longer-lived access token. When it expires, the admin logs in
// again (see src/api/client.ts's 401 handling).
export interface AuthTokens {
  accessToken: string;
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
// read claims right after login, before the token is stored. Mirrors
// mobile/src/api/auth.ts's decodeJwtPayload.
function decodeJwtPayload(token: string): {
  sub: string;
  role?: string;
  admin_role?: AdminRole;
  admin_username?: string;
} {
  const payload = token.split('.')[1];
  return JSON.parse(base64UrlDecode(payload));
}

// Thrown when the credentials are valid but the account isn't an admin --
// distinct from ApiError so the login screen can show a specific message
// instead of a generic "wrong credentials" one.
export class NotAdminError extends Error {}

export async function login(input: LoginInput): Promise<{ user: AdminSessionUser; tokens: AuthTokens }> {
  const tokenResponse = await request<TokenResponse>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const tokens: AuthTokens = {
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
  };

  const { sub, role, admin_role, admin_username } = decodeJwtPayload(tokens.accessToken);
  if (role !== 'admin' || !admin_role || !admin_username) {
    // Technically a valid token, but this tool is admin-only -- refuse
    // client-side and never store it. Kept as defense-in-depth even though
    // /admin/auth/login should never issue a token without these claims.
    throw new NotAdminError('Esta cuenta no tiene permisos de administrador.');
  }

  return { user: { id: sub, username: admin_username, role: admin_role }, tokens };
}
