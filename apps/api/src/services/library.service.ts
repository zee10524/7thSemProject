import type {
  DismissalDto,
  LibraryIndex,
  LibraryStats,
  ListEntryDto,
  ListStatus,
  Page,
  RatingDto,
  RecentReadDto,
} from '@litsense/shared';
import { decodeCursor, paginate } from '../lib/cursor.js';
import { errors } from '../lib/errors.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type { BookCatalog } from './bookCatalog.js';

export class LibraryService {
  constructor(private readonly catalog: BookCatalog) {}

  /** Upserts a rating. Rating a book that is not marked read also marks it read. */
  async rate(
    userId: string,
    bookId: number,
    stars: number,
  ): Promise<{ stars: number; ratedAt: string; profileVersion: number }> {
    await this.catalog.requireBook(bookId);
    const rating = await libraryRepository.upsertRating(userId, bookId, stars);
    const entry = await libraryRepository.findListEntry(userId, bookId);
    if (!entry || entry.status === 'want_to_read' || entry.status === 'currently_reading') {
      await libraryRepository.upsertListEntry(userId, bookId, {
        status: 'read',
        progress: 100,
        startedAt: entry?.startedAt ?? null,
        finishedAt: new Date(),
      });
    }
    const profileVersion = await userRepository.bumpProfileVersion(userId);
    return { stars: rating.stars, ratedAt: rating.ratedAt.toISOString(), profileVersion };
  }

  async unrate(userId: string, bookId: number): Promise<void> {
    if (await libraryRepository.deleteRating(userId, bookId)) await userRepository.bumpProfileVersion(userId);
  }

  async setStatus(
    userId: string,
    bookId: number,
    status: ListStatus,
    progress?: number,
  ): Promise<ListEntryDto> {
    await this.catalog.requireBook(bookId);
    const existing = await libraryRepository.findListEntry(userId, bookId);
    const now = new Date();
    const entry = await libraryRepository.upsertListEntry(userId, bookId, {
      status,
      progress:
        status === 'currently_reading'
          ? (progress ?? existing?.progress ?? 0)
          : status === 'read'
            ? 100
            : null,
      startedAt:
        status === 'currently_reading' ? (existing?.startedAt ?? now) : (existing?.startedAt ?? null),
      finishedAt:
        status === 'read' ? (existing?.status === 'read' ? (existing.finishedAt ?? now) : now) : null,
    });
    if (existing?.status !== status) await userRepository.bumpProfileVersion(userId);
    const book = await this.catalog.getOrThrow(bookId);
    return {
      book,
      status: entry.status,
      progress: entry.progress ?? null,
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async removeFromList(userId: string, bookId: number): Promise<void> {
    if (await libraryRepository.deleteListEntry(userId, bookId))
      await userRepository.bumpProfileVersion(userId);
  }

  async dismiss(userId: string, bookId: number): Promise<void> {
    await this.catalog.requireBook(bookId);
    const res = await libraryRepository.upsertDismissal(userId, bookId);
    if (res.upsertedCount > 0) await userRepository.bumpProfileVersion(userId);
  }

  async undismiss(userId: string, bookId: number): Promise<void> {
    if (await libraryRepository.deleteDismissal(userId, bookId))
      await userRepository.bumpProfileVersion(userId);
  }

  /** Views feed "continue exploring"; they do not bump the profile version (see the rails cache key). */
  async recordView(userId: string, bookId: number): Promise<void> {
    await this.catalog.requireBook(bookId);
    await libraryRepository.recordView(userId, bookId);
  }

  async ratings(userId: string, rawCursor: string | undefined, limit: number): Promise<Page<RatingDto>> {
    const rows = await libraryRepository.ratingsPage(userId, decodeCursor(rawCursor), limit);
    const { rows: page, nextCursor } = paginate(rows, limit, (r) => r.ratedAt);
    const books = await this.catalog.getMany(page.map((r) => r.bookId));
    return {
      items: page.flatMap((r) => {
        const book = books.get(r.bookId);
        return book ? [{ book, stars: r.stars, ratedAt: r.ratedAt.toISOString() }] : [];
      }),
      nextCursor,
    };
  }

  async readingList(
    userId: string,
    status: ListStatus | undefined,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<ListEntryDto>> {
    const rows = await libraryRepository.listPage(userId, status, decodeCursor(rawCursor), limit);
    const { rows: page, nextCursor } = paginate(rows, limit, (r) => r.updatedAt);
    const books = await this.catalog.getMany(page.map((r) => r.bookId));
    return {
      items: page.flatMap((r) => {
        const book = books.get(r.bookId);
        return book
          ? [{ book, status: r.status, progress: r.progress ?? null, updatedAt: r.updatedAt.toISOString() }]
          : [];
      }),
      nextCursor,
    };
  }

  async dismissed(userId: string, rawCursor: string | undefined, limit: number): Promise<Page<DismissalDto>> {
    const rows = await libraryRepository.dismissedPage(userId, decodeCursor(rawCursor), limit);
    const { rows: page, nextCursor } = paginate(rows, limit, (r) => r.dismissedAt);
    const books = await this.catalog.getMany(page.map((r) => r.bookId));
    return {
      items: page.flatMap((r) => {
        const book = books.get(r.bookId);
        return book ? [{ book, dismissedAt: r.dismissedAt.toISOString() }] : [];
      }),
      nextCursor,
    };
  }

  async index(userId: string): Promise<LibraryIndex> {
    const [user, ratings, list, dismissed, reviewed] = await Promise.all([
      userRepository.findById(userId),
      libraryRepository.allRatings(userId),
      libraryRepository.allListEntries(userId),
      libraryRepository.allDismissed(userId),
      profileRepository.reviewedBookIds(userId),
    ]);
    if (!user) throw errors.unauthenticated();
    return {
      ratings: Object.fromEntries(ratings.map((r) => [String(r.bookId), r.stars])),
      statuses: Object.fromEntries(
        list.map((e) => [String(e.bookId), { status: e.status, progress: e.progress ?? null }]),
      ),
      dismissed: dismissed.map((d) => d.bookId),
      reviewed: reviewed.map((r) => r.bookId),
      profileVersion: user.profileVersion ?? 0,
    };
  }

  async stats(userId: string): Promise<LibraryStats> {
    const [ratings, list] = await Promise.all([
      libraryRepository.allRatings(userId),
      libraryRepository.allListEntries(userId),
    ]);
    const read = list.filter((e) => e.status === 'read');
    const books = await this.catalog.getMany(read.map((e) => e.bookId));
    const genres = new Map<string, number>();
    let pagesRead = 0;
    for (const e of read) {
      const b = books.get(e.bookId);
      if (!b) continue;
      pagesRead += b.pages ?? 0;
      for (const g of b.genres.slice(0, 2)) genres.set(g, (genres.get(g) ?? 0) + 1);
    }
    const count = (s: ListStatus) => list.filter((e) => e.status === s).length;
    return {
      read: read.length,
      reading: count('currently_reading'),
      want: count('want_to_read'),
      dropped: count('dropped'),
      rated: ratings.length,
      pagesRead,
      avgStars: ratings.length
        ? Math.round((ratings.reduce((t, r) => t + r.stars, 0) / ratings.length) * 10) / 10
        : null,
      topGenres: [...genres]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([genre, n]) => ({ genre, books: n })),
    };
  }

  async recentReads(userId: string, limit: number): Promise<RecentReadDto[]> {
    const finished = await libraryRepository.recentlyFinished(userId, limit);
    const ids = finished.map((e) => e.bookId);
    const [books, ratings, reviews, analyses] = await Promise.all([
      this.catalog.getMany(ids),
      libraryRepository.allRatings(userId),
      profileRepository.reviewsForBooks(userId, ids),
      profileRepository.analysesForBooks(userId, ids),
    ]);
    const stars = new Map(ratings.map((r) => [r.bookId, r.stars]));
    const reviewBy = new Map(reviews.map((r) => [r.bookId, r]));
    const analysisBy = new Map(analyses.map((a) => [a.bookId, a]));
    return finished.flatMap((e) => {
      const book = books.get(e.bookId);
      if (!book) return [];
      const review = reviewBy.get(e.bookId);
      const analysis = analysisBy.get(e.bookId);
      return [
        {
          book,
          finishedAt: (e.finishedAt ?? e.updatedAt).toISOString(),
          stars: stars.get(e.bookId) ?? null,
          review: review
            ? {
                text: review.text,
                aspects:
                  analysis?.status === 'done' ? ((analysis.aspects ?? {}) as Record<string, number>) : {},
              }
            : null,
        },
      ];
    });
  }
}
