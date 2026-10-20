import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { CatalogPage } from '@litsense/shared';
import { BookModel } from '../src/models/index.js';
import { MockModelService, type ModelService, ModelServiceError } from '../src/modelService/index.js';
import { bookRepository } from '../src/repositories/book.repository.js';
import { signUp, useTestApp } from './helpers.js';

// The real service caps pages below the requested limit; this one serves at most 7 books per page,
// reports its bundle and data version in /health, can be "still loading" (ready=false), and can
// answer 503 for a number of catalogue calls.
const mock = new MockModelService();
const calls: { offset: number; limit: number }[] = [];
let bundle = 'bundle-test-1';
let dataVersion = 'v0';
let bundleFor = (_call: number) => bundle;
let loading = false;
let unavailableCalls = 0;
const model = Object.assign(Object.create(mock) as ModelService, {
  mode: 'http',
  async health(ctx: Parameters<ModelService['health']>[0]) {
    return {
      ...(await mock.health(ctx)),
      ready: !loading,
      bundle_version: bundle,
      data_version: dataVersion,
    };
  },
  async catalogPage(ctx: Parameters<ModelService['catalogPage']>[0], a: { offset: number; limit: number }) {
    if (unavailableCalls > 0) {
      unavailableCalls -= 1;
      throw new ModelServiceError('unavailable', 'upstream 503', 'catalog', 503);
    }
    calls.push(a);
    const page: CatalogPage = await mock.catalogPage(ctx, { offset: a.offset, limit: Math.min(a.limit, 7) });
    return { ...page, bundle_version: bundleFor(calls.length) };
  },
}) as ModelService;

const t = useTestApp({ overrides: { model } });
const total = (await mock.catalogPage({ requestId: 'x' }, { offset: 0, limit: 1 })).total;

describe('seeding the catalogue from the model service', () => {
  it('refuses to switch sources without a reset', async () => {
    await expect(t.c.seed.seed({ source: 'model' })).rejects.toMatchObject({ status: 409 });
  });

  it('pages by offset until total, records bundle and data version, and resets reader data', async () => {
    const s = await signUp(t.app);
    await s.put('/me/ratings/1', { stars: 5 }).expect(200);
    expect(await t.c.catalog.version()).toMatch(/^fixture-/);
    calls.length = 0;

    const res = await t.c.seed.seed({ source: 'model', reset: true });
    expect(res).toEqual({ upserted: total, source: 'model' });
    expect(calls.map((c) => c.offset)).toEqual(Array.from({ length: Math.ceil(total / 7) }, (_, i) => i * 7));
    expect(calls.every((c) => c.limit === 1000)).toBe(true);
    expect(await bookRepository.getMeta()).toMatchObject({
      source: 'model',
      modelVersion: 'bundle-test-1',
      dataVersion: 'v0',
      count: total,
    });
    // Book-keyed caches (insights, grid, feed) roll over with the catalogue version.
    expect(await t.c.catalog.version()).toBe('model-bundle-test-1');
    const ratings = await s.get('/me/ratings').expect(200);
    expect(ratings.body.items).toHaveLength(0);
  });

  it('aborts without writing when the bundle changes mid-read', async () => {
    bundleFor = (call) => (call < 3 ? 'bundle-test-1' : 'bundle-test-2');
    calls.length = 0;
    await expect(t.c.seed.seed({ source: 'model' })).rejects.toMatchObject({ status: 409 });
    expect(calls).toHaveLength(3);
    expect(await bookRepository.getMeta()).toMatchObject({ modelVersion: 'bundle-test-1' });
    bundleFor = () => bundle;
  });

  it('reseeds in place, keeping reader data, for a new bundle of the same data version', async () => {
    const s = await signUp(t.app);
    await s.put('/me/ratings/2', { stars: 4 }).expect(200);
    bundle = 'bundle-test-2';
    await expect(t.c.seed.seed({ source: 'model' })).resolves.toEqual({ upserted: total, source: 'model' });
    expect(await bookRepository.getMeta()).toMatchObject({
      modelVersion: 'bundle-test-2',
      dataVersion: 'v0',
    });
    expect((await s.get('/me/ratings').expect(200)).body.items).toHaveLength(1);
  });

  it('refuses a new data version without reset, and clears reader data with it', async () => {
    const s = await signUp(t.app);
    await s.put('/me/ratings/3', { stars: 5 }).expect(200);
    dataVersion = 'v1';
    bundle = 'bundle-v1';
    calls.length = 0;
    const refused = t.c.seed.seed({ source: 'model' });
    await expect(refused).rejects.toMatchObject({ status: 409 });
    await expect(refused).rejects.toThrow(/data version "v1".*holds "v0"/);
    expect(calls).toHaveLength(0);
    expect(await bookRepository.getMeta()).toMatchObject({
      modelVersion: 'bundle-test-2',
      dataVersion: 'v0',
    });
    expect((await s.get('/me/ratings').expect(200)).body.items).toHaveLength(1);

    await t.c.seed.seed({ source: 'model', reset: true });
    expect(await bookRepository.getMeta()).toMatchObject({ modelVersion: 'bundle-v1', dataVersion: 'v1' });
    expect((await s.get('/me/ratings').expect(200)).body.items).toHaveLength(0);
  });
});

describe('boot and readiness against a model service that is still loading', () => {
  it('reports degraded while the service loads its bundle, and the seed waits', async () => {
    loading = true;
    const res = await request(t.app).get('/readyz').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.model).toEqual({ ok: false, detail: 'http, loading its bundle' });
    await expect(t.c.seed.seed({ source: 'model' })).rejects.toMatchObject({ kind: 'unavailable' });
    loading = false;
    expect((await request(t.app).get('/readyz').expect(200)).body.status).toBe('ready');
  });

  it('is not ready without a catalogue, and the boot seed retries until the service answers', async () => {
    await BookModel.deleteMany({});
    t.c.catalog.invalidate();
    const empty = await request(t.app).get('/readyz').expect(503);
    expect(empty.body.status).toBe('not_ready');
    expect(empty.body.checks.catalog).toEqual({ ok: false, detail: '0 books' });

    unavailableCalls = 2;
    calls.length = 0;
    await t.c.seed.seedOnBoot(new AbortController().signal, 1);
    expect(unavailableCalls).toBe(0);
    expect(calls.length).toBeGreaterThan(0);
    const ready = await request(t.app).get('/readyz').expect(200);
    expect(ready.body.checks.catalog.ok).toBe(true);
  });

  it('stops retrying when aborted', async () => {
    await BookModel.deleteMany({});
    t.c.catalog.invalidate();
    unavailableCalls = 1_000;
    const stop = new AbortController();
    const run = t.c.seed.seedOnBoot(stop.signal, 5);
    setTimeout(() => stop.abort(), 30);
    await run;
    expect(unavailableCalls).toBeGreaterThan(990);
    unavailableCalls = 0;
  });
});
