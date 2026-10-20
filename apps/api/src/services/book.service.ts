import type {
  BookDto,
  GenresResponse,
  InsightsDto,
  Page,
  RecItemDto,
  SearchResponse,
} from '@litsense/shared';
import type { Cached } from '../lib/cache.js';
import { errors } from '../lib/errors.js';
import { shortHash } from '../lib/hash.js';
import type { CallContext, ModelService } from '../modelService/index.js';
import { bookRepository } from '../repositories/book.repository.js';
import { type BookCatalog, toBookDto } from './bookCatalog.js';
import type { UserStateBuilder } from './userState.service.js';

export class BookService {
  constructor(
    private readonly model: ModelService,
    private readonly catalog: BookCatalog,
    private readonly states: UserStateBuilder,
    private readonly cache: Cached,
    private readonly ttlS: number,
  ) {}

  async list(rawCursor: string | undefined, limit: number, genre?: string): Promise<Page<BookDto>> {
    let after: number | null = null;
    if (rawCursor !== undefined) {
      after = Number(rawCursor);
      if (!Number.isInteger(after) || after < 0) throw errors.badRequest('The page cursor is not valid.');
    }
    const rows = await bookRepository.listPage({ afterBookId: after, limit, genre });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toBookDto),
      nextCursor: rows.length > limit && last ? String(last.bookId) : null,
    };
  }

  genres(): Promise<GenresResponse> {
    return this.cache.wrap('genres', 600, async () => ({
      genres: (await bookRepository.genreCounts()).map((g) => ({ name: g._id, count: g.count })),
    }));
  }

  get(bookId: number): Promise<BookDto> {
    return this.catalog.getOrThrow(bookId);
  }

  async insights(ctx: CallContext, bookId: number): Promise<InsightsDto> {
    await this.catalog.requireBook(bookId);
    const version = await this.catalog.version();
    const res = await this.cache.wrap(`insights:${version}:${bookId}`, 24 * 3600, () =>
      this.model.bookInsights(ctx, { bookId }),
    );
    return {
      bookId: res.book_id,
      aspectBars: res.aspect_bars,
      reviewSummary: res.review_summary,
      snippets: res.snippets,
      nReviews: res.n_reviews,
    };
  }

  similar(ctx: CallContext, bookId: number, k: number, userId?: string): Promise<RecItemDto[]> {
    return this.related('similar', ctx, bookId, k, userId);
  }

  moreByAuthor(ctx: CallContext, bookId: number, k: number, userId?: string): Promise<RecItemDto[]> {
    return this.related('author', ctx, bookId, k, userId);
  }

  async search(
    ctx: CallContext,
    q: string,
    k: number,
    genres: string[] | undefined,
  ): Promise<SearchResponse> {
    const filters = genres?.length ? { genres_include: genres } : null;
    const version = await this.catalog.version();
    const key = `search:${version}:${shortHash({ q: q.toLowerCase(), k, genres })}`;
    const [hits, entity] = await this.cache.wrap(key, 300, () =>
      Promise.all([
        this.model.semanticSearch(ctx, { query: q, k, filters }),
        q.length <= 80 ? this.model.resolveEntities(ctx, { query: q }) : Promise.resolve(null),
      ]),
    );
    // An exact title or author match goes first even if search ranked it lower.
    const pinned =
      entity && (entity.kind === 'title' || entity.kind === 'author')
        ? entity.book_ids.map((id) => ({ book_id: id, score: 1, matched: entity.kind as 'title' | 'author' }))
        : [];
    const seen = new Set<number>();
    const merged = [...pinned, ...hits]
      .filter((h) => !seen.has(h.book_id) && seen.add(h.book_id))
      .slice(0, k);
    const books = await this.catalog.getMany(merged.map((h) => h.book_id));
    return {
      hits: merged.flatMap((h) => {
        const book = books.get(h.book_id);
        return book ? [{ book, score: h.score, matched: h.matched }] : [];
      }),
      entity: entity ? { kind: entity.kind, author: entity.author, options: entity.options } : null,
    };
  }

  private async related(
    kind: 'similar' | 'author',
    ctx: CallContext,
    bookId: number,
    k: number,
    userId?: string,
  ): Promise<RecItemDto[]> {
    await this.catalog.requireBook(bookId);
    const state = userId ? await this.states.build(userId) : null;
    const version = await this.catalog.version();
    const key = `${kind}:${version}:${bookId}:${k}:${userId ?? 'anon'}:${state?.profile_version ?? 0}`;
    const items = await this.cache.wrap(key, this.ttlS, () =>
      kind === 'similar'
        ? this.model.similarBooks(ctx, { bookId, k, state })
        : this.model.moreByAuthor(ctx, { bookId, k, state }),
    );
    return this.catalog.hydrate(items);
  }
}
