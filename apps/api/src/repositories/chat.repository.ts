import { Types } from 'mongoose';
import { afterCursor, type Cursor } from '../lib/cursor.js';
import { ChatSessionModel, ExplanationModel } from '../models/index.js';

const oid = (id: string) => new Types.ObjectId(id);

export const chatRepository = {
  create(userId: string) {
    return ChatSessionModel.create({ userId: oid(userId) });
  },

  findOwned(userId: string, sessionId: string) {
    return ChatSessionModel.findOne({ _id: oid(sessionId), userId: oid(userId) }).lean();
  },

  page(userId: string, cursor: Cursor | null, limit: number) {
    return ChatSessionModel.find(
      { userId: oid(userId), ...afterCursor('updatedAt', cursor) },
      { title: 1, updatedAt: 1, createdAt: 1, turnCount: { $size: '$turns' } },
    )
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<{ _id: Types.ObjectId; title: string; updatedAt: Date; turnCount: number }[]>();
  },

  /** Conditional write on the version that was read; returns null when another write won. */
  saveIfVersion(
    userId: string,
    sessionId: string,
    version: number,
    set: { state: unknown; turns: unknown[]; chips: unknown[]; title?: string },
  ) {
    return ChatSessionModel.findOneAndUpdate(
      { _id: oid(sessionId), userId: oid(userId), version },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    ).lean();
  },

  async deleteOwned(userId: string, sessionId: string): Promise<boolean> {
    const res = await ChatSessionModel.deleteOne({ _id: oid(sessionId), userId: oid(userId) });
    return res.deletedCount > 0;
  },

  count() {
    return ChatSessionModel.estimatedDocumentCount();
  },

  // ---------------------------------------------------------------- explanation cache
  findExplanation(userId: string, bookId: number, profileVersion: number) {
    return ExplanationModel.findOne({ userId: oid(userId), bookId, profileVersion }).lean();
  },

  saveExplanation(userId: string, bookId: number, profileVersion: number, payload: unknown) {
    return ExplanationModel.updateOne(
      { userId: oid(userId), bookId, profileVersion },
      { $set: { payload, createdAt: new Date() } },
      { upsert: true },
    );
  },

  async deleteAllForUser(userId: string): Promise<void> {
    await Promise.all([
      ChatSessionModel.deleteMany({ userId: oid(userId) }),
      ExplanationModel.deleteMany({ userId: oid(userId) }),
    ]);
  },
};
