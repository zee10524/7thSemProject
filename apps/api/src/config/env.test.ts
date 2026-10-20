import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

const SECRET = 'env-test-secret-env-test-secret-0001';

describe('loadConfig', () => {
  it('treats empty optional booleans as unset (KEY= in a .env file)', () => {
    const dev = loadConfig({ COOKIE_SECURE: '', WORKER_IN_PROCESS: ' ', SEED_ON_BOOT: '' });
    expect(dev.COOKIE_SECURE).toBeUndefined();
    expect(dev.cookieSecure).toBe(false);
    expect(dev.WORKER_IN_PROCESS).toBe(true);
    expect(dev.SEED_ON_BOOT).toBe(true);
    const prod = loadConfig({ NODE_ENV: 'production', JWT_ACCESS_SECRET: SECRET, COOKIE_SECURE: '' });
    expect(prod.cookieSecure).toBe(true);
  });

  it('parses explicit boolean values and still rejects invalid ones', () => {
    const c = loadConfig({ COOKIE_SECURE: 'false', WORKER_IN_PROCESS: 'no', SEED_ON_BOOT: '1' });
    expect(c.cookieSecure).toBe(false);
    expect(c.WORKER_IN_PROCESS).toBe(false);
    expect(c.SEED_ON_BOOT).toBe(true);
    expect(
      loadConfig({ NODE_ENV: 'production', JWT_ACCESS_SECRET: SECRET, COOKIE_SECURE: 'yes' }).cookieSecure,
    ).toBe(true);
    expect(() => loadConfig({ COOKIE_SECURE: 'maybe' })).toThrow(/COOKIE_SECURE/);
  });

  it('accepts .env.example as is (cp .env.example .env must boot)', () => {
    const example = parse(readFileSync(new URL('../../../../.env.example', import.meta.url)));
    const c = loadConfig(example);
    expect(c.cookieSecure).toBe(false);
    expect(c.MODEL_SERVICE_MODE).toBe('mock');
  });
});
