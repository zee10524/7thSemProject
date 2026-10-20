import { randomUUID } from 'node:crypto';
import type { AnyBulkWriteOperation } from 'mongoose';
import type { CatalogBook } from '@litsense/shared';
import { errors } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { Book } from '../models/index.js';
import { BOOKS as FIXTURE_BOOKS } from '../modelService/mock/catalog.js';
import { type ModelService, ModelServiceError } from '../modelService/index.js';
import { sleep } from '../modelService/retry.js';
import { bookRepository } from '../repositories/book.repository.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { UserModel } from '../models/index.js';
import type { BookCatalog } from './bookCatalog.js';

export type SeedSource = 'model' | 'fixture';

type BookFields = Omit<Book, 'createdAt' | 'updatedAt'>;

/** The service's maximum page size for `/v1/catalog`. */
const CATALOG_PAGE = 1000;

interface LiveVersions {
  bundleVersion: string | null;
  dataVersion: string | null;
}

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
    let live: LiveVersions = { bundleVersion: null, dataVersion: null };
    if (source === 'model') {
      live = await this.liveVersions();
      // Book ids are stable within a data version and renumbered across them (a new bundle of the
      // same data version reseeds in place, keeping reader data).
      const seeded = meta?.source === 'model' && existing > 0 ? (meta.dataVersion ?? null) : null;
      if (seeded && live.dataVersion && seeded !== live.dataVersion && !opts.reset) {
        this.logger.warn(
          { seeded, live: live.dataVersion },
          'reseed refused: the model service serves a new data version, which renumbers book ids',
        );
        throw errors.conflict(
          `The model service now serves data version "${live.dataVersion}" but the catalogue holds "${seeded}". A new data version renumbers book ids; rerun with reset to clear reader data.`,
        );
      }
    }
    const fetched =
      source === 'fixture'
        ? { rows: fixtureRows(), bundleVersion: null }
        : await this.fetchModelCatalog(live.bundleVersion);
    const { rows } = fetched;
    if (!rows.length) throw errors.badRequest('The catalogue is empty; nothing to seed.');

    if (opts.reset) await this.resetReaderData();
    const ops: AnyBulkWriteOperation<Book>[] = rows.map((row) => ({
      updateOne: { filter: { bookId: row.bookId }, update: { $set: row }, upsert: true },
    }));
    for (let i = 0; i < ops.length; i += 1000) await bookRepository.bulkUpsert(ops.slice(i, i + 1000));
    await bookRepository.deleteNotIn(rows.map((r) => r.bookId));
    const modelVersion = fetched.bundleVersion ?? (await this.liveVersions().catch(() => live)).bundleVersion;
    const dataVersion = source === 'model' ? live.dataVersion : null;
    await bookRepository.setMeta({ source, modelVersion, dataVersion, count: rows.length });
    this.catalog.invalidate();
    this.logger.info({ source, count: rows.length, modelVersion, dataVersion }, 'catalogue seeded');
    return { upserted: rows.length, source };
  }

  /**
   * On boot: seed an empty catalogue; otherwise warn when the model service now serves a different
   * bundle than the one the catalogue came from. Reseeding stays a human call: in place for a new
   * bundle of the same data version, with reset for a new data version (book ids renumbered).
   */
  async seedIfEmpty(): Promise<void> {
    if ((await bookRepository.count()) === 0) {
      await this.seed();
      return;
    }
    const meta = await bookRepository.getMeta();
    if (meta?.source !== 'model') return;
    const live = await this.liveVersions().catch(() => null);
    if (!live) return;
    const seeded = { bundleVersion: meta.modelVersion ?? null, dataVersion: meta.dataVersion ?? null };
    if (live.dataVersion && seeded.dataVersion && live.dataVersion !== seeded.dataVersion) {
      this.logger.error(
        { seeded, live },
        'the model service serves a new data version (book ids renumbered); reseed with reset: npm run seed -- --source=model --reset',
      );
    } else if (live.bundleVersion && seeded.bundleVersion && live.bundleVersion !== seeded.bundleVersion) {
      this.logger.warn(
        { seeded, live },
        'the model service serves a new bundle of the same data version; reseed in place: npm run seed -- --source=model',
      );
    }
  }

  /**
   * Boot-time seeding that waits out a model service still loading its bundle: retries with
   * backoff (2 s doubling to 30 s) while the service is unavailable, until it succeeds or `signal`
   * aborts. Any other failure (a conflict, a malformed page) is logged once and not retried.
   */
  async seedOnBoot(signal: AbortSignal, baseDelayMs = 2_000): Promise<void> {
    for (let attempt = 0; !signal.aborted; attempt += 1) {
      try {
        await this.seedIfEmpty();
        return;
      } catch (err) {
        if (!(err instanceof ModelServiceError) || err.kind !== 'unavailable') {
          this.logger.error({ err: (err as Error).message }, 'catalogue seed on boot failed');
          return;
        }
        const retryInMs = Math.min(30_000, baseDelayMs * 2 ** attempt);
        this.logger.warn(
          { attempt: attempt + 1, retryInMs, reason: err.message },
          'model service unavailable; the catalogue seed will retry',
        );
        await sleep(retryInMs, signal).catch(() => undefined);
      }
    }
  }

  /**
   * The bundle and data version the model service serves now, from its `/health`. A service still
   * loading its bundle counts as unavailable, so the boot seed waits for it.
   */
  private async liveVersions(): Promise<LiveVersions> {
    const health = await this.model.health({ requestId: `seed-${randomUUID()}` });
    if (health.ready === false) {
      throw new ModelServiceError('unavailable', 'the model service is loading its bundle', 'health');
    }
    return {
      bundleVersion: typeof health.bundle_version === 'string' ? health.bundle_version : null,
      dataVersion: typeof health.data_version === 'string' ? health.data_version : null,
    };
  }

  /**
   * Pages `/v1/catalog` by offset until `total`. Every page must carry the bundle version the
   * service reported before paging: a bundle swap mid-way would mix two id spaces, so it aborts.
   */
  private async fetchModelCatalog(
    expected: string | null,
  ): Promise<{ rows: BookFields[]; bundleVersion: string | null }> {
    const rows: BookFields[] = [];
    let bundleVersion: string | null = expected;
    let offset = 0;
    const ctx = { requestId: `seed-${randomUUID()}` };
    for (let page = 0; page < 10_000; page += 1) {
      const res = await this.model.catalogPage(ctx, { offset, limit: CATALOG_PAGE });
      if (bundleVersion !== null && res.bundle_version !== bundleVersion) {
        throw errors.conflict(
          'The model service changed bundles while the catalogue was being read; rerun the seed.',
        );
      }
      bundleVersion = res.bundle_version;
      rows.push(...res.items.map((r) => fromCatalogRow(r, 'model')));
      offset += res.items.length;
      if (!res.items.length || offset >= res.total) break;
    }
    return { rows, bundleVersion };
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
