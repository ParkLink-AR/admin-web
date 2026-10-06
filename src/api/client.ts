import { useSessionStore } from '@/src/store/useSessionStore';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// Retrying a failed login with the same rejected credentials is meaningless.
const NO_RETRY_PATHS = ['/admin/auth/login'];

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = `Error ${response.status}`;
  try {
    const body = await response.json();
    // Each backend puts its real human-readable text in a different field --
    // same precedence as mobile/src/api/client.ts's toApiError:
    // `detail` (auth-service, payment-service) first, `message`
    // (parking-service, payment-service) next, `error` (booking-service)
    // last, `title` as a final fallback.
    detail = body.detail || body.message || body.error || body.title || detail;
  } catch {
    // Not a JSON body -- keep the generic message.
  }
  return new ApiError(response.status, detail);
}

async function rawFetch(
  path: string,
  options: RequestInit,
  accessToken: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, { ...options, headers, cache: 'no-store' });
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string
): Promise<T> {
  // A caller-supplied token (e.g. login() right after getting a brand-new
  // access token, before it's stored) is used as-is.
  if (tokenOverride) {
    const response = await rawFetch(path, options, tokenOverride);
    if (!response.ok) throw await toApiError(response);
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  const { accessToken } = useSessionStore.getState();
  const response = await rawFetch(path, options, accessToken);

  // Admin sessions don't have a refresh token to rotate -- a 401 on an
  // authenticated request just means the access token expired or was
  // revoked, so the session is cleared and the router (reacting to `user`
  // becoming null) redirects to login. Worst case the admin re-logs in.
  if (response.status === 401 && accessToken && !NO_RETRY_PATHS.includes(path)) {
    useSessionStore.getState().clearSession();
    return undefined as T;
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Multipart uploads (mark-paid proof photo) can't go through `request()`: it
// always forces `Content-Type: application/json`, but FormData needs fetch to
// set its own `multipart/form-data; boundary=...` instead.
async function rawMultipartFetch(
  path: string,
  formData: FormData,
  accessToken: string | null
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, { method: 'POST', body: formData, headers, cache: 'no-store' });
}

export async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const { accessToken } = useSessionStore.getState();
  const response = await rawMultipartFetch(path, formData, accessToken);

  if (response.status === 401 && accessToken) {
    useSessionStore.getState().clearSession();
    return undefined as T;
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}
