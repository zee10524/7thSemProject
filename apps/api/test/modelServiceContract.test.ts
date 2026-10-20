/**
 * Drift test: every call the HTTP client makes must exist in the model service's published OpenAPI
 * (zee10524/LightGcn, branch serve-api, service/openapi.json, vendored in test/fixtures) and send only
 * the fields its request schema allows, because the service rejects unknown fields with a 400. Every
 * MockModelService answer must also validate against the published response schema, so switching
 * from the mock to the real service is config only. Refresh the fixture when the service changes.
 */
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { type SessionState, UserState } from '@litsense/shared';
import { createLogger } from '../src/lib/logger.js';
import { CircuitBreaker, HttpModelService, MockModelService } from '../src/modelService/index.js';
import { MODEL_ROUTES } from '../src/modelService/http.js';

interface Schema {
  $ref?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}
interface Operation {
  requestBody?: { content: { 'application/json': { schema: Schema } } };
  parameters?: { name: string; in: string }[];
  responses: Record<string, { content?: { 'application/json'?: { schema: Schema } } }>;
}
interface OpenApi {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}

const spec = JSON.parse(
  readFileSync(new URL('./fixtures/model-service.openapi.json', import.meta.url), 'utf8'),
) as OpenApi;
const resolve = (s: Schema): Schema =>
  s.$ref ? (spec.components.schemas[s.$ref.split('/').pop() ?? ''] ?? {}) : s;

const mock = new MockModelService();
const ctx = { requestId: 'contract-test-1', clientId: 'pseudonym' };
const state = UserState.parse({ ratings: [{ book_id: 1, stars: 4, ts: 1_760_000_000_000 }] });

/** Records each request the client sends and answers it from the in-process mock. */
function recordingClient() {
  const sent: { method: string; path: string; query: string; body: unknown }[] = [];
  const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    sent.push({ method: init?.method ?? 'GET', path: url.pathname, query: url.search, body });
    const answer = await answerFromMock(url.pathname, body as Record<string, never>);
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const svc = new HttpModelService({
    baseUrl: 'http://model.test',
    serviceKey: 'k',
    timeoutMs: 1000,
    slowTimeoutMs: 1000,
    retries: 0,
    breaker: new CircuitBreaker({ failureThreshold: 5, cooldownMs: 1000 }),
    logger: createLogger({ level: 'silent' }),
    fetchImpl,
  });
  return { svc, sent };
}

async function answerFromMock(path: string, b: Record<string, never>): Promise<unknown> {
  const c = { requestId: 'mock' };
  if (path === '/health') return mock.health(c);
  if (path === '/v1/recommend') return mock.recommend(c, { state, k: 3 });
  if (path === '/v1/home-rails') return mock.homeRails(c, { state });
  if (path === '/v1/similar-books') return mock.similarBooks(c, { bookId: 1, k: 3 });
  if (path === '/v1/more-by-author') return mock.moreByAuthor(c, { bookId: 1, k: 3 });
  if (path === '/v1/semantic-search') return mock.semanticSearch(c, { query: 'cozy', k: 3 });
  if (path === '/v1/resolve-entities') return mock.resolveEntities(c, { query: 'Circe' });
  if (path === '/v1/onboarding-grid') return mock.onboardingGrid(c, { n: 5 });
  if (path === '/v1/parse-onboarding') return mock.parseOnboarding(c, { text: 'fantasy', picks: [] });
  if (path === '/v1/explain') return mock.explain(c, { state, bookId: 2 });
  if (path === '/v1/chat-turn') return mock.chatTurn(c, { state, session: null, message: 'cozy' });
  if (path.startsWith('/v1/book-insights/')) return mock.bookInsights(c, { bookId: 2 });
  if (path === '/v1/analyze-user-review') return mock.analyzeUserReview(c, { text: 'Loved it.' });
  if (path === '/v1/metrics-report') return mock.metricsReport(c);
  if (path === '/v1/catalog') return mock.catalogPage(c, { offset: 0, limit: 5 });
  throw new Error(`unexpected path ${path} ${JSON.stringify(b)}`);
}

const templateFor = (path: string) =>
  Object.keys(spec.paths).find((p) => new RegExp(`^${p.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path));

/** Validators for each route's 200 body, with `#/components` refs pointed at the vendored spec. */
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
ajv.addSchema({ $id: 'model-service', components: spec.components });
function responseValidator(path: string, method: 'get' | 'post') {
  const schema = spec.paths[path]?.[method]?.responses['200']?.content?.['application/json']?.schema;
  if (!schema) throw new Error(`no 200 JSON response for ${method} ${path}`);
  const rebased = JSON.parse(
    JSON.stringify(schema).replaceAll('"#/components/', '"model-service#/components/'),
  );
  return ajv.compile(rebased as object);
}
function expectPublishedShape(path: string, method: 'get' | 'post', body: unknown) {
  const validate = responseValidator(path, method);
  const ok = validate(JSON.parse(JSON.stringify(body)));
  expect(ok ? [] : validate.errors, `${method.toUpperCase()} ${path}`).toEqual([]);
}

describe('HTTP client vs the model service OpenAPI', () => {
  it('has every route the client knows about, with the same method', () => {
    for (const route of Object.values(MODEL_ROUTES)) {
      const template = templateFor(route.path.replace(/\{[^}]+\}/g, '1'));
      expect(template, route.path).toBeDefined();
      expect(
        spec.paths[template!]![route.method.toLowerCase()],
        `${route.method} ${route.path}`,
      ).toBeDefined();
    }
  });

  it('sends only allowed fields, and every required one, on every call', async () => {
    const { svc, sent } = recordingClient();
    await svc.health(ctx);
    await svc.recommend(ctx, { state, k: 5, filters: { max_pages: 300 }, exclude: [3] });
    await svc.homeRails(ctx, { state });
    await svc.similarBooks(ctx, { bookId: 1, k: 4, state });
    await svc.moreByAuthor(ctx, { bookId: 1, k: 4, state: null });
    await svc.semanticSearch(ctx, { query: 'cozy', k: 5 });
    await svc.resolveEntities(ctx, { query: 'Circe' });
    await svc.onboardingGrid(ctx, { n: 60 });
    await svc.parseOnboarding(ctx, { text: 'fantasy', picks: [1] });
    await svc.explain(ctx, { state, bookId: 2 });
    await svc.chatTurn(ctx, { state, session: null, message: 'cozy' });
    await svc.bookInsights(ctx, { bookId: 2 });
    await svc.analyzeUserReview(ctx, { text: 'Loved it.' });
    await svc.metricsReport(ctx);
    await svc.catalogPage(ctx, { offset: 0, limit: 1000 });

    expect(sent).toHaveLength(15);
    for (const call of sent) {
      const template = templateFor(call.path);
      expect(template, call.path).toBeDefined();
      const op = spec.paths[template!]![call.method.toLowerCase()]!;
      const reqSchema = op.requestBody?.content['application/json'].schema;
      if (!reqSchema) {
        expect(call.body, `${call.method} ${call.path} sends no body`).toBeUndefined();
        const allowed = new Set((op.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name));
        for (const key of new URLSearchParams(call.query).keys()) expect(allowed, call.path).toContain(key);
        continue;
      }
      const schema = resolve(reqSchema);
      const body = call.body as Record<string, unknown>;
      for (const key of Object.keys(body))
        expect(Object.keys(schema.properties ?? {}), `${call.path}: ${key}`).toContain(key);
      for (const key of schema.required ?? [])
        expect(Object.keys(body), `${call.path} requires ${key}`).toContain(key);
    }
  });

  it('answers from the mock in exactly the published response shapes', async () => {
    const c = { requestId: 'mock' };
    const cold = UserState.parse({});
    expectPublishedShape('/health', 'get', await mock.health(c));
    for (const s of [cold, state]) {
      expectPublishedShape('/v1/recommend', 'post', await mock.recommend(c, { state: s, k: 10 }));
      expectPublishedShape('/v1/home-rails', 'post', await mock.homeRails(c, { state: s }));
    }
    expectPublishedShape(
      '/v1/recommend',
      'post',
      await mock.recommend(c, { state, k: 5, filters: { max_pages: 300 }, exclude: [3] }),
    );
    for (const bookId of [1, 2, 41]) {
      expectPublishedShape('/v1/similar-books', 'post', await mock.similarBooks(c, { bookId, k: 5, state }));
      expectPublishedShape('/v1/more-by-author', 'post', await mock.moreByAuthor(c, { bookId, k: 5 }));
      expectPublishedShape('/v1/explain', 'post', await mock.explain(c, { state, bookId }));
      expectPublishedShape('/v1/book-insights/{book_id}', 'get', await mock.bookInsights(c, { bookId }));
    }
    for (const query of ['cozy', 'andy weir', 'astronaut friendship', 'zzzz']) {
      expectPublishedShape('/v1/semantic-search', 'post', await mock.semanticSearch(c, { query, k: 5 }));
      expectPublishedShape('/v1/resolve-entities', 'post', await mock.resolveEntities(c, { query }));
    }
    expectPublishedShape('/v1/onboarding-grid', 'get', await mock.onboardingGrid(c, { n: 30 }));
    for (const text of ['', 'cozy fantasy, nothing too long', 'I loved Circe and The Martian'])
      expectPublishedShape(
        '/v1/parse-onboarding',
        'post',
        await mock.parseOnboarding(c, { text, picks: [1, 2] }),
      );

    let session: SessionState | null = null;
    for (const message of [
      'something cozy',
      'shorter please',
      'like Circe',
      'hmm',
      'more like the first one',
    ]) {
      const reply = await mock.chatTurn(c, { state, session, message });
      expectPublishedShape('/v1/chat-turn', 'post', reply);
      session = reply.session;
    }
    for (const text of ['Loved it, the prose is gorgeous.', 'Too slow and the ending fell flat.', 'ok'])
      expectPublishedShape('/v1/analyze-user-review', 'post', await mock.analyzeUserReview(c, { text }));
    expectPublishedShape('/v1/metrics-report', 'get', await mock.metricsReport(c));
    expectPublishedShape('/v1/catalog', 'get', await mock.catalogPage(c, { offset: 0, limit: 1000 }));
    expectPublishedShape('/v1/catalog', 'get', await mock.catalogPage(c, { offset: 40, limit: 10 }));
  });

  it('catches a response that drifts from the published shape', async () => {
    const validate = responseValidator('/v1/catalog', 'get');
    const page = await mock.catalogPage({ requestId: 'mock' }, { offset: 0, limit: 2 });
    const { bundle_version: _v, ...noVersion } = page;
    expect(validate(noVersion)).toBe(false);
    const { title: _t, ...untitled } = page.items[0]!;
    expect(validate({ ...page, items: [untitled] })).toBe(false);
    expect(validate({ ...page, total: 'many' })).toBe(false);
  });
});
