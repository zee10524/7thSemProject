import { LRUCache } from 'lru-cache';
import type { BookDto, ChatItem, ChatItemDto, RecItem, RecItemDto } from '@litsense/shared';
import { errors } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { bookRepository, type BookRow } from '../repositories/book.repository.js';

export function toBookDto(row: BookRow): BookDto {
  return {
    bookId: row.bookId,
    title: row.title,
    author: row.author ?? null,
    genres: row.genres ?? [],
    primaryGenre: row.primaryGenre,
    year: row.year ?? null,
    pages: row.pages ?? null,
    description: row.description ?? '',
    image: row.image ?? null,
    isbn13: row.isbn13 ?? null,
    series: row.series?.id
      ? { id: row.series.id, name: row.series.name ?? null, pos: row.series.pos ?? null }
      : null,
    avgRating: row.avgRating ?? null,
    ratingsCount: row.ratingsCount ?? null,
    tagline: row.tagline ?? null,
    cover: row.cover?.c1
      ? {
          c1: row.cover.c1,
          c2: row.cover.c2 ?? row.cover.c1,
          ink: row.cover.ink ?? '#fff',
          accent: row.cover.accent ?? '#fff',
          motif: row.cover.motif ?? 'stars',
          layout: row.cover.layout ?? 'center',
          font: row.cover.font ?? 'serif',
        }
      : null,
  };
}

/**
 * The catalogue the core's `book_id`s refer to. Keeps the id set in memory (to validate writes and
 * to drop stale ids before they reach the core) and an LRU of hydrated books for responses.
 */
export class BookCatalog {
  private ids: Promise<Set<number>> | null = null;
  private tag: Promise<string> | null = null;
  private readonly dtos = new LRUCache<number, BookDto>({ max: 5000 });

  constructor(private readonly logger: Logger) {}

  invalidate(): void {
    this.ids = null;
    this.tag = null;
    this.dtos.clear();
  }

  /**
   * Which catalogue the ids belong to (source plus bundle version). Book ids change between bundles,
   * so every cache keyed by a book id includes this and rolls over on a reseed.
   */
  version(): Promise<string> {
    this.tag ??= bookRepository
      .getMeta()
      .then((m) => (m ? `${m.source}-${m.modelVersion ?? 'none'}` : 'unseeded'))
      .catch((err: unknown) => {
        this.tag = null;
        throw err;
      });
    return this.tag;
  }

  knownIds(): Promise<Set<number>> {
    this.ids ??= bookRepository.allIds().then((ids) => new Set(ids));
    return this.ids;
  }

  async has(bookId: number): Promise<boolean> {
    return (await this.knownIds()).has(bookId);
  }

  async requireBook(bookId: number): Promise<void> {
    if (!(await this.has(bookId))) throw errors.notFound('Book');
  }

  async getMany(ids: number[]): Promise<Map<number, BookDto>> {
    const out = new Map<number, BookDto>();
    const missing: number[] = [];
    for (const id of new Set(ids)) {
      const hit = this.dtos.get(id);
      if (hit) out.set(id, hit);
      else missing.push(id);
    }
    if (missing.length) {
      for (const row of await bookRepository.findByIds(missing)) {
        const dto = toBookDto(row);
        this.dtos.set(dto.bookId, dto);
        out.set(dto.bookId, dto);
      }
    }
    return out;
  }

  async get(bookId: number): Promise<BookDto | null> {
    return (await this.getMany([bookId])).get(bookId) ?? null;
  }

  async getOrThrow(bookId: number): Promise<BookDto> {
    const book = await this.get(bookId);
    if (!book) throw errors.notFound('Book');
    return book;
  }

  /** Joins core items with our books; items whose book we do not have are dropped and logged. */
  async hydrate(items: RecItem[]): Promise<RecItemDto[]> {
    const books = await this.getMany(items.map((i) => i.book_id));
    const out: RecItemDto[] = [];
    for (const item of items) {
      const book = books.get(item.book_id);
      if (!book) {
        this.logger.warn({ bookId: item.book_id }, 'model returned a book that is not in the catalogue');
        continue;
      }
      out.push({
        book,
        rank: item.rank,
        score: item.score,
        sources: item.sources,
        reason: item.reason,
        reasonMethod: item.reason_method,
        evidence: item.evidence,
      });
    }
    return out;
  }

  async hydrateChatItems(items: ChatItem[]): Promise<ChatItemDto[]> {
    const books = await this.getMany(items.map((i) => i.book_id));
    return items.flatMap((item) => {
      const book = books.get(item.book_id);
      return book ? [{ book, reason: item.reason, evidence: item.evidence }] : [];
    });
  }
}
