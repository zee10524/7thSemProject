import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CircuitBreaker, HttpModelService } from '../src/modelService/index.js';
import { createLogger } from '../src/lib/logger.js';
import { signUp, useTestApp } from './helpers.js';

// A model service that is down: every call fails to connect. Threshold 2 so the breaker opens fast.
const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 60_000 });
const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
const down = new HttpModelService({
  baseUrl: 'http://model.invalid',
  serviceKey: 'k',
  timeoutMs: 100,
  slowTimeoutMs: 100,
  retries: 0,
  breaker,
  logger: createLogger({ level: 'silent' }),
  fetchImpl: (async () => {
    throw refused;
  }) as unknown as typeof fetch,
});

const t = useTestApp({ overrides: { model: down, breaker } });

describe('when the model service is down', () => {
  it('returns MODEL_UNAVAILABLE for model calls, keeps the rest working, and opens the breaker', async () => {
    const s = await signUp(t.app);
    const feed = await s.get('/recommendations').expect(503);
    expect(feed.body.error.code).toBe('MODEL_UNAVAILABLE');
    expect(feed.headers['retry-after']).toBeTruthy();

    // Accounts and shelves do not depend on the model service.
    await s.get('/me').expect(200);
    await s.put('/me/ratings/1', { stars: 4 }).expect(200);

    await s.get('/recommendations/rails').expect(503);
    expect(breaker.snapshot().state).toBe('open');

    const ready = await request(t.app).get('/readyz').expect(200);
    expect(ready.body.status).toBe('degraded');
  });
});
