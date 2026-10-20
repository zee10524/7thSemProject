import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from './circuitBreaker.js';
import { backoffDelay } from './retry.js';

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('CircuitBreaker', () => {
  it('opens after the failure threshold and fails fast during the cooldown', () => {
    const c = clock();
    const b = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, now: c.now });
    for (let i = 0; i < 3; i += 1) {
      expect(b.tryAcquire()).toBe(true);
      b.onFailure();
    }
    expect(b.snapshot().state).toBe('open');
    expect(b.tryAcquire()).toBe(false);
  });

  it('lets exactly one trial through when half-open, and closes on success', () => {
    const c = clock();
    const b = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: c.now });
    b.onFailure();
    c.advance(1000);
    expect(b.snapshot().state).toBe('half_open');
    expect(b.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(false);
    b.onSuccess();
    expect(b.snapshot()).toEqual({ state: 'closed', failures: 0 });
  });

  it('reopens when the half-open trial fails', () => {
    const c = clock();
    const b = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 500, now: c.now });
    b.onFailure();
    c.advance(500);
    expect(b.tryAcquire()).toBe(true);
    b.onFailure();
    expect(b.snapshot().state).toBe('open');
  });

  it('resets the failure count after a success', () => {
    const b = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
    b.onFailure();
    b.onFailure();
    b.onSuccess();
    b.onFailure();
    expect(b.snapshot()).toEqual({ state: 'closed', failures: 1 });
  });
});

describe('backoffDelay (full jitter)', () => {
  it('stays within [0, min(cap, base * 2^attempt)]', () => {
    expect(backoffDelay(0, 100, 1000, () => 0.999)).toBe(99);
    expect(backoffDelay(3, 100, 1000, () => 0.999)).toBe(799);
    expect(backoffDelay(10, 100, 1000, () => 0.999)).toBe(999);
    expect(backoffDelay(5, 100, 1000, () => 0)).toBe(0);
  });
});
