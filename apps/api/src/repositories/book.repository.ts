import type { AnyBulkWriteOperation } from 'mongoose';
import { type Book, BookModel, CatalogMetaModel } from '../models/index.js';

export type BookRow = Book & { _id: unknown };

export const bookRepository = {
  findByIds(ids: number[]) {
    return BookModel.find({ bookId: { $in: ids } }).lean<BookRow[]>();
  },

  findOne(bookId: number) {
    return BookModel.findOne({ bookId: { $eq: bookId } }).lean<BookRow>();
  },

  async allIds(): Promise<number[]> {
    const rows = await BookModel.find({}, { bookId: 1, _id: 0 }).lean<{ bookId: number }[]>();
    return rows.map((r) => r.bookId);
  },

  /** Paged by bookId ascending; the cursor is the last bookId seen. */
  listPage(opts: { afterBookId: number | null; limit: number; genre?: string }) {
    const filter: Record<string, unknown> = {};
    if (opts.afterBookId !== null) filter.bookId = { $gt: opts.afterBookId };
    if (opts.genre) filter.genres = { $eq: opts.genre };
    return BookModel.find(filter)
      .sort({ bookId: 1 })
      .limit(opts.limit + 1)
      .lean<BookRow[]>();
  },

  genreCounts() {
    return BookModel.aggregate<{ _id: string; count: number }>([
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
  },

  bulkUpsert(ops: AnyBulkWriteOperation<Book>[]) {
    return BookModel.bulkWrite(ops, { ordered: false });
  },

  deleteNotIn(bookIds: number[]) {
    return BookModel.deleteMany({ bookId: { $nin: bookIds } });
  },

  count() {
    return BookModel.estimatedDocumentCount();
  },

  getMeta() {
    return CatalogMetaModel.findOne({ key: 'catalog' }).lean();
  },

  setMeta(meta: {
    source: 'model' | 'fixture';
    modelVersion: string | null;
    dataVersion: string | null;
    count: number;
  }) {
    return CatalogMetaModel.updateOne(
      { key: 'catalog' },
      { $set: { ...meta, seededAt: new Date() } },
      { upsert: true },
    );
  },
};
