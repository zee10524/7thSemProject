import { describe, expect, it, vi } from 'vitest';
import { UserState } from '@litsense/shared';
import { createLogger } from '../lib/logger.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { HttpModelService } from './http.js';
import { MockModelService } from './mock/mockModelService.js';
import { ModelServiceError } from './types.js';

const logger = createLogger({ level: 'silent' });
const ctx = { requestId: 'req-test-0001' };
const state = { ratings: [], profile_version: 3 } as never;

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

function fakeFetch(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = replies.shift() ?? { status: 500 };
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json', ...(next.headers ?? {}) },
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function client(
  replies: Reply[],
  opts: { retries?: number; threshold?: number; slowTimeoutMs?: number } = {},
) {
  const f = fakeFetch(replies);
  const breaker = new CircuitBreaker({ failureThreshold: opts.threshold ?? 10, cooldownMs: 60_000 });
  const svc = new HttpModelService({
    baseUrl: 'http://model.test/',
    serviceKey: 'svc-key',
    timeoutMs: 200,
    slowTimeoutMs: opts.slowTimeoutMs ?? 200,
    retries: opts.retries ?? 2,
    breaker,
    logger,
    fetchImpl: f.impl,
    random: () => 0,
  });
  return { svc, breaker, calls: f.calls };
}

const mock = new MockModelService();
const rec = await mock.recommend(ctx, { state: UserState.parse({}), k: 3 });

describe('HttpModelService', () => {
  it('posts the contract body with the API key, request id and reader pseudonym', async () => {
    const { svc, calls } = client([{ status: 200, body: rec }]);
    const res = await svc.recommend(
      { ...ctx, clientId: 'reader-pseudonym' },
      { state, k: 3, filters: { max_pages: 300 } },
    );
    expect(res.items).toHaveLength(3);
    expect(calls[0]?.url).toBe('http://model.test/v1/recommend');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('svc-key');
    expect(headers['x-request-id']).toBe('req-test-0001');
    expect(headers['x-client-id']).toBe('reader-pseudonym');
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      k: 3,
      filters: { max_pages: 300 },
      use_ranker: true,
    });
  });

  it('retries 503 with backoff and then succeeds', async () => {
    const { svc, calls } = client([{ status: 503 }, { status: 503 }, { status: 200, body: rec }]);
    await expect(svc.recommend(ctx, { state, k: 3 })).resolves.toBeTruthy();
    expect(calls).toHaveLength(3);
  });

  it('gives up after the retry budget as unavailable', async () => {
    const { svc, calls } = client([{ status: 502 }, { status: 502 }, { status: 502 }], { retries: 2 });
    await expect(svc.recommend(ctx, { state, k: 3 })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(calls).toHaveLength(3);
  });

  it('does not retry a 4xx and reports it as rejected', async () => {
    const { svc, calls } = client([{ status: 422, body: { error: { code: 'bad_input' } } }]);
    await expect(svc.recommend(ctx, { state, k: 3 })).rejects.toMatchObject({
      kind: 'rejected',
      status: 422,
    });
    expect(calls).toHaveLength(1);
  });

  it('rejects a response that does not match the contract', async () => {
    const { svc } = client([{ status: 200, body: { items: 'nope' } }]);
    await expect(svc.recommend(ctx, { state, k: 3 })).rejects.toMatchObject({ kind: 'bad_response' });
  });

  it('opens the circuit and then fails fast without calling upstream', async () => {
    const { svc, breaker, calls } = client([{ status: 500 }, { status: 500 }], { retries: 0, threshold: 2 });
    await expect(svc.health(ctx)).rejects.toBeInstanceOf(ModelServiceError);
    await expect(svc.health(ctx)).rejects.toBeInstanceOf(ModelServiceError);
    expect(breaker.snapshot().state).toBe('open');
    await expect(svc.health(ctx)).rejects.toMatchObject({ message: 'circuit open' });
    expect(calls).toHaveLength(2);
  });

  it('retries an LLM-backed call only when it certainly did not run', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    const reply = await mock.chatTurn(ctx, { state: UserState.parse({}), session: null, message: 'cozy' });
    const chat = (svc: HttpModelService) => svc.chatTurn(ctx, { state, session: null, message: 'cozy' });

    const a = client([
      refused,
      { status: 503, headers: { 'retry-after': '0' } },
      { status: 200, body: reply },
    ]);
    await expect(chat(a.svc)).resolves.toMatchObject({ intro: reply.intro });
    expect(a.calls).toHaveLength(3); // connection refused, then 503 overloaded, then success

    const b = client([new Error('socket hang up'), { status: 200, body: reply }]);
    await expect(chat(b.svc)).rejects.toMatchObject({ kind: 'unavailable' });
    expect(b.calls).toHaveLength(1);

    const c = client([{ status: 500 }, { status: 200, body: reply }]);
    await expect(chat(c.svc)).rejects.toMatchObject({ kind: 'unavailable' });
    expect(c.calls).toHaveLength(1); // a 500 may have spent an LLM call: no retry
  });

  it('gets insights by path parameter', async () => {
    const insights = await mock.bookInsights(ctx, { bookId: 4 });
    const { svc, calls } = client([{ status: 200, body: insights }]);
    await svc.bookInsights(ctx, { bookId: 4 });
    expect(calls[0]?.url).toBe('http://model.test/v1/book-insights/4');
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it('accepts list responses wrapped in an envelope', async () => {
    const { svc } = client([
      { status: 200, body: { items: rec.items } },
      { status: 200, body: { book_ids: [3, 1, 2] } },
    ]);
    await expect(svc.similarBooks(ctx, { bookId: 1, k: 3 })).resolves.toHaveLength(3);
    await expect(svc.onboardingGrid(ctx, { n: 3 })).resolves.toEqual([3, 1, 2]);
  });

  it('pages the catalogue by offset and computes the next offset', async () => {
    const page = await mock.catalogPage(ctx, { cursor: null, limit: 30 });
    const body = { bundle_version: 'bundle-v0', total: 43, offset: 0, limit: 30, items: page.items };
    const { svc, calls } = client([
      { status: 200, body },
      { status: 200, body: { ...body, offset: 30, items: page.items.slice(0, 13) } },
    ]);
    const first = await svc.catalogPage(ctx, { cursor: null, limit: 30 });
    expect(calls[0]?.url).toBe('http://model.test/v1/catalog?offset=0&limit=30');
    expect(first.next_cursor).toBe(30);
    expect(first.bundle_version).toBe('bundle-v0');
    const second = await svc.catalogPage(ctx, { cursor: first.next_cursor, limit: 30 });
    expect(calls[1]?.url).toBe('http://model.test/v1/catalog?offset=30&limit=30');
    expect(second.next_cursor).toBeNull();
  });
});
