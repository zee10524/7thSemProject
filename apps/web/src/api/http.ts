import type { ErrorEnvelope } from '@litsense/shared';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Typed form of the API error envelope `{ error: { code, message, details?, requestId } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors from VALIDATION_FAILED, keyed by the field name after `body.`. */
  fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION_FAILED' || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path?: string; message?: string }[]) {
      const key = (d.path ?? '').replace(/^body\./, '');
      if (key && !out[key]) out[key] = d.message ?? 'Not valid';
    }
    return out;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

// The CSRF token lives in memory only; its httpOnly cookie twin is checked by the server.
let csrfToken: string | null = null;
let csrfLoading: Promise<string> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfLoading ??= fetch(`${BASE}/auth/csrf`, { credentials: 'include' })
    .then(async (res) => {
      const body = (await res.json()) as { csrfToken: string };
      csrfToken = body.csrfToken;
      return body.csrfToken;
    })
    .finally(() => {
      csrfLoading = null;
    });
  return csrfLoading;
}

type Listener = () => void;
const sessionEndedListeners = new Set<Listener>();
/** Called when a refresh fails: the session is over and the app should show the sign-in page. */
export function onSessionEnded(fn: Listener): () => void {
  sessionEndedListeners.add(fn);
  return () => sessionEndedListeners.delete(fn);
}

let refreshing: Promise<boolean> | null = null;
/** One refresh at a time: parallel 401s share it, so a rotated token is never presented twice. */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await rawFetch('POST', '/auth/refresh');
      if (!res.ok) return false;
      const body = (await res.json()) as { csrfToken?: string };
      if (body.csrfToken) csrfToken = body.csrfToken;
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function rawFetch(method: string, path: string, init: RequestOptions = {}): Promise<Response> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers ?? {}) };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (UNSAFE.has(method)) headers['X-CSRF-Token'] = await ensureCsrf();
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  return fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | string[] | null | undefined>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ErrorEnvelope;
    return new ApiError(
      res.status,
      body.error.code,
      body.error.message,
      body.error.details,
      body.error.requestId,
    );
  } catch {
    return new ApiError(res.status, 'INTERNAL', 'Something went wrong. Try again.');
  }
}

export async function request<T>(method: string, path: string, init: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await rawFetch(method, path, init);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'You seem to be offline. Check the connection and try again.');
  }

  if (res.status === 403 && UNSAFE.has(method)) {
    const err = await toError(res);
    if (err.code !== 'CSRF_FAILED') throw err;
    csrfToken = null; // stale token (e.g. another tab signed in): fetch a fresh one and retry once
    res = await rawFetch(method, path, init);
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await rawFetch(method, path, init);
    if (res.status === 401) {
      sessionEndedListeners.forEach((fn) => fn());
      throw await toError(res);
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, init?: RequestOptions) => request<T>('GET', path, init),
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>('POST', path, { ...init, body }),
  put: <T>(path: string, body?: unknown, init?: RequestOptions) => request<T>('PUT', path, { ...init, body }),
  patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>('PATCH', path, { ...init, body }),
  del: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>('DELETE', path, { ...init, body }),
};

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function errorMessage(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === 'MODEL_UNAVAILABLE')
      return 'The recommendation engine is taking a break. Try again in a moment.';
    return err.message;
  }
  return 'Something went wrong. Try again.';
}
