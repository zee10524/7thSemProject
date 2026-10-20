import { describe, expect, it } from 'vitest';
import type { CatalogPage } from '@litsense/shared';
import { MockModelService, type ModelService } from '../src/modelService/index.js';
import { bookRepository } from '../src/repositories/book.repository.js';
import { signUp, useTestApp } from './helpers.js';

// The real service caps pages below the requested limit; this one serves at most 7 books per page.
const mock = new MockModelService();
const calls: { offset: number; limit: number }[] = [];
let bundleFor = (_call: number) => 'bundle-test-1';
const model = Object.assign(Object.create(mock) as ModelService, {
  mode: 'http',
  async catalogPage(ctx: Parameters<ModelService['catalogPage']>[0], a: { offset: number; limit: number }) {
    calls.push(a);
    const page: CatalogPage = await mock.catalogPage(ctx, { offset: a.offset, limit: Math.min(a.limit, 7) });
    return { ...page, bundle_version: bundleFor(calls.length) };
  },
}) as ModelService;

const t = useTestApp({ overrides: { model } });

describe('seeding the catalogue from the model service', () => {
  it('refuses to switch sources without a reset', async () => {
    await expect(t.c.seed.seed({ source: 'model' })).rejects.toMatchObject({ status: 409 });
  });

  it('pages by offset until total, records the bundle, and resets reader data', async () => {
    const s = await signUp(t.app);
    await s.put('/me/ratings/1', { stars: 5 }).expect(200);
    expect(await t.c.catalog.version()).toMatch(/^fixture-/);
    calls.length = 0;

    const res = await t.c.seed.seed({ source: 'model', reset: true });
    const total = (await mock.catalogPage({ requestId: 'x' }, { offset: 0, limit: 1 })).total;
    expect(res).toEqual({ upserted: total, source: 'model' });
    expect(calls.map((c) => c.offset)).toEqual(Array.from({ length: Math.ceil(total / 7) }, (_, i) => i * 7));
    expect(calls.every((c) => c.limit === 1000)).toBe(true);
    expect(await bookRepository.getMeta()).toMatchObject({
      source: 'model',
      modelVersion: 'bundle-test-1',
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
  });
});
