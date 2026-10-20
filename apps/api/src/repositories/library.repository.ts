import { Types } from 'mongoose';
import type { ListStatus } from '@litsense/shared';
import { afterCursor, type Cursor } from '../lib/cursor.js';
import { DismissalModel, RatingModel, ReadingListModel, ViewModel } from '../models/index.js';

const oid = (id: string) => new Types.ObjectId(id);

export const libraryRepository = {
  // ---------------------------------------------------------------- ratings
  allRatings(userId: string) {
    return RatingModel.find({ userId: oid(userId) }, { bookId: 1, stars: 1, ratedAt: 1 }).lean();
  },

  ratingsPage(userId: string, cursor: Cursor | null, limit: number) {
    return RatingModel.find({ userId: oid(userId), ...afterCursor('ratedAt', cursor) })
      .sort({ ratedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
  },

  upsertRating(userId: string, bookId: number, stars: number) {
    return RatingModel.findOneAndUpdate(
      { userId: oid(userId), bookId },
      { $set: { stars, ratedAt: new Date() } },
      { upsert: true, new: true },
    ).lean();
  },

  findRating(userId: string, bookId: number) {
    return RatingModel.findOne({ userId: oid(userId), bookId }).lean();
  },

  async deleteRating(userId: string, bookId: number): Promise<boolean> {
    const res = await RatingModel.deleteOne({ userId: oid(userId), bookId });
    return res.deletedCount > 0;
  },

  // ---------------------------------------------------------------- reading list
  allListEntries(userId: string) {
    return ReadingListModel.find({ userId: oid(userId) }).lean();
  },

  listPage(userId: string, status: ListStatus | undefined, cursor: Cursor | null, limit: number) {
    return ReadingListModel.find({
      userId: oid(userId),
      ...(status ? { status: { $eq: status } } : {}),
      ...afterCursor('updatedAt', cursor),
    })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
  },

  findListEntry(userId: string, bookId: number) {
    return ReadingListModel.findOne({ userId: oid(userId), bookId }).lean();
  },

  upsertListEntry(
    userId: string,
    bookId: number,
    set: { status: ListStatus; progress: number | null; startedAt?: Date | null; finishedAt?: Date | null },
  ) {
    const now = new Date();
    return ReadingListModel.findOneAndUpdate(
      { userId: oid(userId), bookId },
      { $set: { ...set, updatedAt: now } },
      { upsert: true, new: true },
    ).lean();
  },

  async deleteListEntry(userId: string, bookId: number): Promise<boolean> {
    const res = await ReadingListModel.deleteOne({ userId: oid(userId), bookId });
    return res.deletedCount > 0;
  },

  recentlyFinished(userId: string, limit: number) {
    return ReadingListModel.find({ userId: oid(userId), status: 'read' })
      .sort({ finishedAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();
  },

  // ---------------------------------------------------------------- dismissals
  allDismissed(userId: string) {
    return DismissalModel.find({ userId: oid(userId) }, { bookId: 1 }).lean();
  },

  dismissedPage(userId: string, cursor: Cursor | null, limit: number) {
    return DismissalModel.find({ userId: oid(userId), ...afterCursor('dismissedAt', cursor) })
      .sort({ dismissedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
  },

  upsertDismissal(userId: string, bookId: number) {
    return DismissalModel.updateOne(
      { userId: oid(userId), bookId },
      { $setOnInsert: { dismissedAt: new Date() } },
      { upsert: true },
    );
  },

  async deleteDismissal(userId: string, bookId: number): Promise<boolean> {
    const res = await DismissalModel.deleteOne({ userId: oid(userId), bookId });
    return res.deletedCount > 0;
  },

  // ---------------------------------------------------------------- views
  recentViews(userId: string, limit = 50) {
    return ViewModel.find({ userId: oid(userId) }, { bookId: 1, viewedAt: 1 })
      .sort({ viewedAt: -1 })
      .limit(limit)
      .lean();
  },

  recordView(userId: string, bookId: number) {
    return ViewModel.updateOne(
      { userId: oid(userId), bookId },
      { $set: { viewedAt: new Date() } },
      { upsert: true },
    );
  },

  countRatings() {
    return RatingModel.estimatedDocumentCount();
  },

  async deleteAllForUser(userId: string): Promise<void> {
    const filter = { userId: oid(userId) };
    await Promise.all([
      RatingModel.deleteMany(filter),
      ReadingListModel.deleteMany(filter),
      DismissalModel.deleteMany(filter),
      ViewModel.deleteMany(filter),
    ]);
  },
};
