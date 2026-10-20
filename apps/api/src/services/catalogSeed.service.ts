import { randomUUID } from 'node:crypto';
import type { AnyBulkWriteOperation } from 'mongoose';
import type { CatalogBook } from '@litsense/shared';
import { errors } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { Book } from '../models/index.js';
import { BOOKS as FIXTURE_BOOKS } from '../modelService/mock/catalog.js';
import type { ModelService } from '../modelService/index.js';
import { bookRepository } from '../repositories/book.repository.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { UserModel } from '../models/index.js';
import type { BookCatalog } from './bookCatalog.js';

export type SeedSource = 'model' | 'fixture';

type BookFields = Omit<Book, 'createdAt' | 'updatedAt'>;

function fromCatalogRow(row: CatalogBook, source: SeedSource): BookFields {
  return {
    bookId: row.book_id,
    canonicalId: row.canonical_id,
    title: row.title,
    author: row.author,
    authorKey: row.author
      ? row.author
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
      : null,
    genres: row.genres,
    primaryGenre: row.primary_genre,
    year: row.year,
    pages: row.pages,
    description: row.description,
    image: row.image,
    isbn13: row.isbn13,
    series: row.series_id ? { id: row.series_id, name: row.series_name, pos: row.series_pos } : null,
    avgRating: null,
    ratingsCount: null,
    tagline: null,
    cover: null,
    source,
  } as BookFields;
}

function fixtureRows(): BookFields[] {
  return FIXTURE_BOOKS.map((b) => ({
    ...fromCatalogRow(b, 'fixture'),
    avgRating: b.avg_rating,
    ratingsCount: b.ratings_count,
    tagline: b.tagline,
    cover: b.cover,
  })) as BookFields[];
}

/**
 * Seeds the Book collection from the model service's catalogue (`/v1/catalog`, paged) or from the
 * bundled fixture (the mock's catalogue). Book ids are the core's `book_id`s, so switching sources
 * would silently remap every rating; that needs an explicit reset that clears reader data.
 */
export class CatalogSeedService {
  constructor(
    private readonly model: ModelService,
    private readonly catalog: BookCatalog,
    private readonly logger: Logger,
  ) {}

  defaultSource(): SeedSource {
    return this.model.mode === 'mock' ? 'fixture' : 'model';
  }

  async seed(
    opts: { source?: SeedSource; reset?: boolean } = {},
  ): Promise<{ upserted: number; source: SeedSource }> {
    const source = opts.source ?? this.defaultSource();
    const meta = await bookRepository.getMeta();
    const existing = await bookRepository.count();
    if (meta && meta.source !== source && existing > 0 && !opts.reset) {
      throw errors.conflict(
        `The catalogue was seeded from "${meta.source}". Switching to "${source}" changes book ids; rerun with reset to clear reader data.`,
      );
    }
    const rows = source === 'fixture' ? fixtureRows() : await this.fetchModelCatalog();
    if (!rows.length) throw errors.badRequest('The catalogue is empty; nothing to seed.');

    if (opts.reset) await this.resetReaderData();
    const ops: AnyBulkWriteOperation<Book>[] = rows.map((row) => ({
      updateOne: { filter: { bookId: row.bookId }, update: { $set: row }, upsert: true },
    }));
    for (let i = 0; i < ops.length; i += 1000) await bookRepository.bulkUpsert(ops.slice(i, i + 1000));
    await bookRepository.deleteNotIn(rows.map((r) => r.bookId));
    let modelVersion: string | null = null;
    try {
      modelVersion = (await this.model.health({ requestId: `seed-${randomUUID()}` })).bundle_version ?? null;
    } catch {
      modelVersion = null;
    }
    await bookRepository.setMeta({ source, modelVersion, count: rows.length });
    this.catalog.invalidate();
    this.logger.info({ source, count: rows.length }, 'catalogue seeded');
    return { upserted: rows.length, source };
  }

  /** Seeds on boot when the collection is empty (SEED_ON_BOOT). */
  async seedIfEmpty(): Promise<void> {
    if ((await bookRepository.count()) > 0) return;
    await this.seed();
  }

  private async fetchModelCatalog(): Promise<BookFields[]> {
    const out: BookFields[] = [];
    let cursor: string | number | null = null;
    const ctx = { requestId: `seed-${randomUUID()}` };
    for (let page = 0; page < 1000; page += 1) {
      const res = await this.model.catalogPage(ctx, { cursor, limit: 500 });
      out.push(...res.items.map((r) => fromCatalogRow(r, 'model')));
      if (res.next_cursor === null || res.next_cursor === undefined || !res.items.length) break;
      cursor = res.next_cursor;
    }
    return out;
  }

  private async resetReaderData(): Promise<void> {
    const users = await UserModel.find({}, { _id: 1 }).lean();
    for (const u of users) {
      const id = String(u._id);
      await Promise.all([
        libraryRepository.deleteAllForUser(id),
        profileRepository.deleteAllForUser(id),
        chatRepository.deleteAllForUser(id),
      ]);
    }
    await UserModel.updateMany({}, { $inc: { profileVersion: 1 }, $set: { onboardedAt: null } });
    this.logger.warn({ users: users.length }, 'reader data cleared for a catalogue switch');
  }
}
