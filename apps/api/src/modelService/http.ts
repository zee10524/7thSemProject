import { z } from 'zod';
import {
  BookInsights,
  CatalogPage,
  ChatReply,
  EntityMatch,
  Explanation,
  HomeRails,
  MetricsReport,
  ModelHealth,
  OnboardingResult,
  RecItem,
  RecResponse,
  ReviewAnalysis,
  SearchHit,
} from '@litsense/shared';
import type { Logger } from '../lib/logger.js';
import { type CircuitBreaker } from './circuitBreaker.js';
import { backoffDelay, sleep } from './retry.js';
import { type CallContext, type ModelService, ModelServiceError } from './types.js';

export interface HttpModelServiceOptions {
  baseUrl: string;
  serviceKey: string;
  timeoutMs: number;
  slowTimeoutMs: number;
  retries: number;
  breaker: CircuitBreaker;
  logger: Logger;
  fetchImpl?: typeof fetch;
  random?: () => number;
}

/**
 * One route per contract function. `retry: 'safe'` retries on network errors, timeouts, 429 and 5xx;
 * `'connect'` (LLM-backed calls with long timeouts) retries only when the connection itself failed.
 * Paths follow the model service's `/v1/<function>` layout; change them here if its OpenAPI differs.
 */
const ROUTES = {
  health: { method: 'GET', path: '/v1/health', slow: false, retry: 'safe' },
  recommend: { method: 'POST', path: '/v1/recommend', slow: false, retry: 'safe' },
  home_rails: { method: 'POST', path: '/v1/home_rails', slow: false, retry: 'safe' },
  similar_books: { method: 'POST', path: '/v1/similar_books', slow: false, retry: 'safe' },
  more_by_author: { method: 'POST', path: '/v1/more_by_author', slow: false, retry: 'safe' },
  semantic_search: { method: 'POST', path: '/v1/semantic_search', slow: false, retry: 'safe' },
  resolve_entities: { method: 'POST', path: '/v1/resolve_entities', slow: false, retry: 'safe' },
  onboarding_grid: { method: 'GET', path: '/v1/onboarding_grid', slow: false, retry: 'safe' },
  parse_onboarding: { method: 'POST', path: '/v1/parse_onboarding', slow: true, retry: 'connect' },
  explain: { method: 'POST', path: '/v1/explain', slow: true, retry: 'connect' },
  chat_turn: { method: 'POST', path: '/v1/chat_turn', slow: true, retry: 'connect' },
  book_insights: { method: 'POST', path: '/v1/book_insights', slow: false, retry: 'safe' },
  analyze_user_review: { method: 'POST', path: '/v1/analyze_user_review', slow: true, retry: 'connect' },
  metrics_report: { method: 'GET', path: '/v1/metrics_report', slow: false, retry: 'safe' },
  catalog: { method: 'GET', path: '/v1/catalog', slow: true, retry: 'safe' },
} as const satisfies Record<
  string,
  { method: 'GET' | 'POST'; path: string; slow: boolean; retry: 'safe' | 'connect' }
>;

type Operation = keyof typeof ROUTES;

/** Accepts a bare list or a list wrapped in a common envelope key. */
function listOf<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      for (const key of ['items', 'hits', 'book_ids', 'results', 'data']) {
        const inner = (value as Record<string, unknown>)[key];
        if (Array.isArray(inner)) return inner;
      }
    }
    return value;
  }, z.array(item));
}

class RetryableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly connectFailure = false,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

const CONNECT_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET']);

function isConnectFailure(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } })?.cause;
  return Boolean(cause?.code && CONNECT_CODES.has(cause.code));
}

export class HttpModelService implements ModelService {
  readonly mode = 'http' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly opts: HttpModelServiceOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
  }

  get breaker(): CircuitBreaker {
    return this.opts.breaker;
  }

  health(ctx: CallContext) {
    return this.call('health', ModelHealth, ctx);
  }

  recommend(ctx: CallContext, a: Parameters<ModelService['recommend']>[1]) {
    return this.call('recommend', RecResponse, ctx, {
      body: {
        state: a.state,
        k: a.k,
        filters: a.filters ?? null,
        exclude: a.exclude ?? [],
        use_ranker: true,
      },
    });
  }

  homeRails(ctx: CallContext, a: Parameters<ModelService['homeRails']>[1]) {
    return this.call('home_rails', HomeRails, ctx, { body: { state: a.state } });
  }

  similarBooks(ctx: CallContext, a: Parameters<ModelService['similarBooks']>[1]) {
    return this.call('similar_books', listOf(RecItem), ctx, {
      body: { book_id: a.bookId, k: a.k, state: a.state ?? null },
    });
  }

  moreByAuthor(ctx: CallContext, a: Parameters<ModelService['moreByAuthor']>[1]) {
    return this.call('more_by_author', listOf(RecItem), ctx, {
      body: { book_id: a.bookId, k: a.k, state: a.state ?? null },
    });
  }

  semanticSearch(ctx: CallContext, a: Parameters<ModelService['semanticSearch']>[1]) {
    return this.call('semantic_search', listOf(SearchHit), ctx, {
      body: { query: a.query, k: a.k, filters: a.filters ?? null },
    });
  }

  resolveEntities(ctx: CallContext, a: { query: string }) {
    return this.call('resolve_entities', EntityMatch, ctx, { body: { query: a.query } });
  }

  onboardingGrid(ctx: CallContext, a: { n: number }) {
    return this.call('onboarding_grid', listOf(z.number().int().min(0)), ctx, { query: { n: String(a.n) } });
  }

  parseOnboarding(ctx: CallContext, a: { text: string; picks: number[] }) {
    return this.call('parse_onboarding', OnboardingResult, ctx, { body: { text: a.text, picks: a.picks } });
  }

  explain(ctx: CallContext, a: Parameters<ModelService['explain']>[1]) {
    return this.call('explain', Explanation, ctx, { body: { state: a.state, book_id: a.bookId } });
  }

  chatTurn(ctx: CallContext, a: Parameters<ModelService['chatTurn']>[1]) {
    return this.call('chat_turn', ChatReply, ctx, {
      body: { state: a.state, session: a.session, message: a.message },
    });
  }

  bookInsights(ctx: CallContext, a: { bookId: number }) {
    return this.call('book_insights', BookInsights, ctx, { body: { book_id: a.bookId } });
  }

  analyzeUserReview(ctx: CallContext, a: { text: string }) {
    return this.call('analyze_user_review', ReviewAnalysis, ctx, { body: { text: a.text } });
  }

  metricsReport(ctx: CallContext) {
    return this.call('metrics_report', MetricsReport, ctx);
  }

  catalogPage(ctx: CallContext, a: { cursor: string | number | null; limit: number }) {
    const query: Record<string, string> = { limit: String(a.limit) };
    if (a.cursor !== null && a.cursor !== undefined) query.cursor = String(a.cursor);
    return this.call('catalog', CatalogPage, ctx, { query });
  }

  private async call<S extends z.ZodType>(
    op: Operation,
    schema: S,
    ctx: CallContext,
    input: { body?: unknown; query?: Record<string, string> } = {},
  ): Promise<z.output<S>> {
    const route = ROUTES[op];
    const maxAttempts = 1 + this.opts.retries;
    let lastError: RetryableError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (!this.opts.breaker.tryAcquire()) {
        throw new ModelServiceError('unavailable', 'circuit open', op);
      }
      try {
        const data = await this.once(op, input, ctx);
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          this.opts.logger.error(
            { op, requestId: ctx.requestId, issues: parsed.error.issues.slice(0, 5) },
            'model service response failed schema validation',
          );
          throw new ModelServiceError('bad_response', 'response did not match the contract', op);
        }
        return parsed.data;
      } catch (err) {
        if (!(err instanceof RetryableError)) throw err;
        lastError = err;
        const canRetry = route.retry === 'safe' || err.connectFailure;
        if (!canRetry || attempt === maxAttempts - 1 || ctx.signal?.aborted) break;
        const delay = Math.max(err.retryAfterMs ?? 0, backoffDelay(attempt, 150, 2000, this.opts.random));
        this.opts.logger.warn(
          { op, attempt: attempt + 1, delay, reason: err.message },
          'retrying model service call',
        );
        await sleep(Math.min(delay, 5000), ctx.signal);
      }
    }
    throw new ModelServiceError('unavailable', lastError?.message ?? 'unavailable', op, lastError?.status);
  }

  /** One HTTP attempt. Resolves with parsed JSON, throws RetryableError or ModelServiceError. */
  private async once(
    op: Operation,
    input: { body?: unknown; query?: Record<string, string> },
    ctx: CallContext,
  ) {
    const route = ROUTES[op];
    const url = new URL(this.baseUrl + route.path);
    for (const [k, v] of Object.entries(input.query ?? {})) url.searchParams.set(k, v);
    const timeoutMs = route.slow ? this.opts.slowTimeoutMs : this.opts.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs);
    const onOuterAbort = () => controller.abort(ctx.signal?.reason);
    ctx.signal?.addEventListener('abort', onOuterAbort, { once: true });
    const started = performance.now();

    try {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: route.method,
          headers: {
            accept: 'application/json',
            'x-service-key': this.opts.serviceKey,
            'x-request-id': ctx.requestId,
            ...(route.method === 'POST' ? { 'content-type': 'application/json' } : {}),
          },
          body: route.method === 'POST' ? JSON.stringify(input.body ?? {}) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        this.opts.breaker.onFailure();
        const message = controller.signal.aborted
          ? String((controller.signal.reason as Error)?.message ?? 'aborted')
          : (err as Error).message;
        throw new RetryableError(message, undefined, isConnectFailure(err));
      }

      const ms = Math.round(performance.now() - started);
      this.opts.logger.debug({ op, status: res.status, ms, requestId: ctx.requestId }, 'model service call');

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        throw new RetryableError(
          'rate limited',
          429,
          false,
          Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
        );
      }
      if (res.status >= 500) {
        this.opts.breaker.onFailure();
        throw new RetryableError(`upstream ${res.status}`, res.status);
      }
      // The service answered: it is up, whatever the answer.
      this.opts.breaker.onSuccess();
      const text = await res.text();
      if (!res.ok) {
        this.opts.logger.error(
          { op, status: res.status, requestId: ctx.requestId, body: text.slice(0, 500) },
          'model service rejected the request',
        );
        throw new ModelServiceError('rejected', `upstream ${res.status}`, op, res.status);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new ModelServiceError('bad_response', 'response was not JSON', op, res.status);
      }
    } finally {
      clearTimeout(timer);
      ctx.signal?.removeEventListener('abort', onOuterAbort);
    }
  }
}
