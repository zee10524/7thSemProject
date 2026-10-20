import type { ExplanationDto, FeedResponse, FiltersInput, RailsResponse } from '@litsense/shared';
import type { Cached } from '../lib/cache.js';
import { shortHash } from '../lib/hash.js';
import type { CallContext, ModelService } from '../modelService/index.js';
import { chatRepository } from '../repositories/chat.repository.js';
import type { BookCatalog } from './bookCatalog.js';
import type { UserStateBuilder } from './userState.service.js';

export interface FeedOptions {
  k: number;
  filters: FiltersInput;
}

export class RecommendationService {
  constructor(
    private readonly model: ModelService,
    private readonly states: UserStateBuilder,
    private readonly catalog: BookCatalog,
    private readonly cache: Cached,
    private readonly ttlS: number,
  ) {}

  /** Main feed. Cached per (catalogue, user, profile_version, query): any state change misses the cache. */
  async feed(ctx: CallContext, userId: string, opts: FeedOptions): Promise<FeedResponse> {
    const [state, version] = await Promise.all([this.states.build(userId), this.catalog.version()]);
    const key = `rec:${version}:${userId}:${state.profile_version}:${shortHash(opts)}`;
    const res = await this.cache.wrap(key, this.ttlS, () =>
      this.model.recommend(ctx, { state, k: opts.k, filters: opts.filters }),
    );
    const [items, continueSeries] = await Promise.all([
      this.catalog.hydrate(res.items),
      this.catalog.hydrate(res.continue_series),
    ]);
    return {
      items,
      continueSeries,
      bucket: res.bucket,
      degraded: res.degraded,
      modelVersion: res.model_version,
      profileVersion: state.profile_version,
    };
  }

  /** Home rails. Views do not bump profile_version, so the newest view is part of the key. */
  async rails(ctx: CallContext, userId: string): Promise<RailsResponse> {
    const [state, version] = await Promise.all([this.states.build(userId), this.catalog.version()]);
    const key = `rails:${version}:${userId}:${state.profile_version}:${state.viewed[0] ?? 'none'}`;
    const rails = await this.cache.wrap(key, this.ttlS, () => this.model.homeRails(ctx, { state }));
    const anchors = await this.catalog.getMany(rails.because_you_liked.map((b) => b.anchor_book_id));
    const h = (items: typeof rails.top_picks) => this.catalog.hydrate(items);
    const [
      topPicks,
      trending,
      moreByAuthors,
      continueExploring,
      hiddenGems,
      fromReadingList,
      continueSeries,
      because,
    ] = await Promise.all([
      h(rails.top_picks),
      h(rails.trending),
      h(rails.more_by_authors),
      h(rails.continue_exploring),
      h(rails.hidden_gems),
      h(rails.from_reading_list),
      h(rails.continue_series),
      Promise.all(
        rails.because_you_liked.map(async (b) => ({
          anchor: anchors.get(b.anchor_book_id),
          items: await h(b.items),
        })),
      ),
    ]);
    return {
      topPicks,
      trending,
      moreByAuthors,
      continueExploring,
      hiddenGems,
      fromReadingList,
      continueSeries,
      becauseYouLiked: because.flatMap((b) => (b.anchor ? [{ anchor: b.anchor, items: b.items }] : [])),
      profileVersion: state.profile_version,
    };
  }

  /** "Why this?" Cached in Mongo per (user, book, profile_version): LLM text is slow and rate-limited. */
  async explain(ctx: CallContext, userId: string, bookId: number): Promise<ExplanationDto> {
    await this.catalog.requireBook(bookId);
    const state = await this.states.build(userId);
    const cached = await chatRepository.findExplanation(userId, bookId, state.profile_version);
    if (cached) return cached.payload as ExplanationDto;
    const exp = await this.model.explain(ctx, { state, bookId });
    const dto: ExplanationDto = {
      bookId: exp.book_id,
      text: exp.text,
      method: exp.method,
      evidence: exp.evidence,
    };
    await chatRepository.saveExplanation(userId, bookId, state.profile_version, dto);
    return dto;
  }
}
