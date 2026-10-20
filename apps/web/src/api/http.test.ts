import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http, onSessionEnded, setCsrfToken } from './http';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let calls: { url: string; init: RequestInit }[] = [];
function mockFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}

const header = (init: RequestInit, name: string) =>
  (init.headers as Record<string, string> | undefined)?.[name];

beforeEach(() => setCsrfToken(null));
afterEach(() => vi.unstubAllGlobals());

describe('http client', () => {
  it('fetches a CSRF token once and sends it on unsafe requests only', async () => {
    mockFetch((url) =>
      url.endsWith('/auth/csrf') ? json(200, { csrfToken: 'tok-1' }) : json(200, { ok: true }),
    );
    await http.get('/me');
    await http.put('/me/ratings/1', { stars: 4 });
    await http.post('/me/views/1');
    expect(calls.filter((c) => c.url.endsWith('/auth/csrf'))).toHaveLength(1);
    const get = calls.find((c) => c.url.endsWith('/me'))!;
    const put = calls.find((c) => c.url.endsWith('/me/ratings/1'))!;
    expect(header(get.init, 'X-CSRF-Token')).toBeUndefined();
    expect(header(put.init, 'X-CSRF-Token')).toBe('tok-1');
    expect(put.init.credentials).toBe('include');
  });

  it('refreshes once on 401 and retries; parallel 401s share one refresh', async () => {
    let refreshed = false;
    mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json(200, { csrfToken: 'tok' });
      if (url.endsWith('/auth/refresh')) {
        refreshed = true;
        return json(200, { csrfToken: 'tok-2', user: {} });
      }
      return refreshed
        ? json(200, { ok: url })
        : json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    });
    const [a, b] = await Promise.all([http.get('/me'), http.get('/me/library')]);
    expect(a).toEqual({ ok: expect.stringContaining('/me') });
    expect(b).toEqual({ ok: expect.stringContaining('/me/library') });
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('ends the session when the refresh fails', async () => {
    const ended = vi.fn();
    const off = onSessionEnded(ended);
    mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json(200, { csrfToken: 'tok' });
      return json(401, { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    });
    await expect(http.get('/me')).rejects.toBeInstanceOf(ApiError);
    expect(ended).toHaveBeenCalledTimes(1);
    off();
  });

  it('turns the error envelope into an ApiError with field errors', async () => {
    mockFetch((url) =>
      url.endsWith('/auth/csrf')
        ? json(200, { csrfToken: 'tok' })
        : json(400, {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Some fields are not valid.',
              details: [{ path: 'body.password', message: 'Use at least 10 characters' }],
              requestId: 'req-1',
            },
          }),
    );
    const err = await http.post('/auth/register', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fieldErrors()).toEqual({ password: 'Use at least 10 characters' });
    expect((err as ApiError).requestId).toBe('req-1');
  });

  it('retries once with a fresh token after CSRF_FAILED', async () => {
    let n = 0;
    mockFetch((url) => {
      if (url.endsWith('/auth/csrf')) return json(200, { csrfToken: `tok-${++n}` });
      return n === 1 ? json(403, { error: { code: 'CSRF_FAILED', message: 'stale' } }) : json(204);
    });
    await expect(http.put('/me/dismissed/3')).resolves.toBeUndefined();
    const puts = calls.filter((c) => c.url.endsWith('/me/dismissed/3'));
    expect(puts.map((p) => header(p.init, 'X-CSRF-Token'))).toEqual(['tok-1', 'tok-2']);
  });
});
