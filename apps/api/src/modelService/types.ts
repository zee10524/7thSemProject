import type {
  BookInsights,
  CatalogPage,
  ChatReply,
  EntityMatch,
  Explanation,
  FiltersInput,
  HomeRails,
  MetricsReport,
  ModelHealth,
  OnboardingResult,
  RecItem,
  RecResponse,
  ReviewAnalysis,
  SearchHit,
  SessionState,
  UserState,
} from '@litsense/shared';

/** Per-call context: the request id is forwarded as X-Request-Id for cross-service tracing. */
export interface CallContext {
  requestId: string;
  signal?: AbortSignal;
}

/**
 * The litsense_core public API (contract section 2) as the backend sees it. Two implementations:
 * HttpModelService (the Python model service) and MockModelService (in-process, contract shapes).
 */
export interface ModelService {
  readonly mode: 'mock' | 'http';
  health(ctx: CallContext): Promise<ModelHealth>;
  recommend(
    ctx: CallContext,
    args: { state: UserState; k: number; filters?: FiltersInput | null; exclude?: number[] },
  ): Promise<RecResponse>;
  homeRails(ctx: CallContext, args: { state: UserState }): Promise<HomeRails>;
  similarBooks(
    ctx: CallContext,
    args: { bookId: number; k: number; state?: UserState | null },
  ): Promise<RecItem[]>;
  moreByAuthor(
    ctx: CallContext,
    args: { bookId: number; k: number; state?: UserState | null },
  ): Promise<RecItem[]>;
  semanticSearch(
    ctx: CallContext,
    args: { query: string; k: number; filters?: FiltersInput | null },
  ): Promise<SearchHit[]>;
  resolveEntities(ctx: CallContext, args: { query: string }): Promise<EntityMatch>;
  onboardingGrid(ctx: CallContext, args: { n: number }): Promise<number[]>;
  parseOnboarding(ctx: CallContext, args: { text: string; picks: number[] }): Promise<OnboardingResult>;
  explain(ctx: CallContext, args: { state: UserState; bookId: number }): Promise<Explanation>;
  chatTurn(
    ctx: CallContext,
    args: { state: UserState; session: SessionState | null; message: string },
  ): Promise<ChatReply>;
  bookInsights(ctx: CallContext, args: { bookId: number }): Promise<BookInsights>;
  analyzeUserReview(ctx: CallContext, args: { text: string }): Promise<ReviewAnalysis>;
  metricsReport(ctx: CallContext): Promise<MetricsReport>;
  catalogPage(
    ctx: CallContext,
    args: { cursor: string | number | null; limit: number },
  ): Promise<CatalogPage>;
}

export type FailureKind = 'unavailable' | 'rejected' | 'bad_response';

/** Raised by model-service clients; `kind` decides the HTTP status the API returns. */
export class ModelServiceError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
    readonly operation: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ModelServiceError';
  }
}
