import { Types } from 'mongoose';
import type { OnboardingProfile } from '@litsense/shared';
import { afterCursor, type Cursor } from '../lib/cursor.js';
import { OnboardingModel, ReviewAnalysisModel, ReviewModel } from '../models/index.js';

const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

export const profileRepository = {
  // ---------------------------------------------------------------- onboarding
  findOnboarding(userId: string) {
    return OnboardingModel.findOne({ userId: oid(userId) }).lean();
  },

  upsertOnboarding(
    userId: string,
    data: {
      picks: number[];
      text: string;
      profile: OnboardingProfile;
      displayChips: string[];
      method: 'llm' | 'embed_only';
    },
  ) {
    return OnboardingModel.findOneAndUpdate(
      { userId: oid(userId) },
      { $set: data },
      { upsert: true, new: true },
    ).lean();
  },

  updateOnboardingProfile(userId: string, profile: OnboardingProfile, displayChips: string[]) {
    return OnboardingModel.findOneAndUpdate(
      { userId: oid(userId) },
      { $set: { profile, displayChips } },
      { new: true },
    ).lean();
  },

  // ---------------------------------------------------------------- reviews
  upsertReview(userId: string, bookId: number, text: string, stars: number | null) {
    return ReviewModel.findOneAndUpdate(
      { userId: oid(userId), bookId },
      { $set: { text, stars } },
      { upsert: true, new: true },
    ).lean();
  },

  findReviewById(id: string | Types.ObjectId) {
    return ReviewModel.findById(oid(id)).lean();
  },

  findReview(userId: string, bookId: number) {
    return ReviewModel.findOne({ userId: oid(userId), bookId }).lean();
  },

  reviewsPage(userId: string, cursor: Cursor | null, limit: number) {
    return ReviewModel.find({ userId: oid(userId), ...afterCursor('updatedAt', cursor) })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
  },

  reviewsForBooks(userId: string, bookIds: number[]) {
    return ReviewModel.find({ userId: oid(userId), bookId: { $in: bookIds } }).lean();
  },

  reviewedBookIds(userId: string) {
    return ReviewModel.find({ userId: oid(userId) }, { bookId: 1 }).lean();
  },

  async deleteReview(userId: string, bookId: number): Promise<boolean> {
    const res = await ReviewModel.deleteOne({ userId: oid(userId), bookId });
    await ReviewAnalysisModel.deleteOne({ userId: oid(userId), bookId });
    return res.deletedCount > 0;
  },

  countReviews() {
    return ReviewModel.estimatedDocumentCount();
  },

  // ---------------------------------------------------------------- analyses
  markAnalysisPending(
    userId: string | Types.ObjectId,
    bookId: number,
    reviewId: Types.ObjectId,
    revision: number,
  ) {
    return ReviewAnalysisModel.updateOne(
      { userId: oid(userId), bookId },
      {
        $set: { reviewId, revision, status: 'pending', ts: revision, error: null, attempts: 0 },
        $setOnInsert: { aspects: {}, spoilerSentences: 0 },
      },
      { upsert: true },
    );
  },

  /** Stores a finished analysis only if it is for the latest revision of the review. */
  async completeAnalysis(
    reviewId: Types.ObjectId,
    revision: number,
    result: { aspects: Record<string, number>; spoilerSentences: number },
  ): Promise<boolean> {
    const res = await ReviewAnalysisModel.updateOne(
      { reviewId, revision },
      {
        $set: {
          status: 'done',
          aspects: result.aspects,
          spoilerSentences: result.spoilerSentences,
          error: null,
        },
      },
    );
    return res.modifiedCount > 0;
  },

  failAnalysis(reviewId: Types.ObjectId, revision: number, error: string, attempts: number) {
    return ReviewAnalysisModel.updateOne(
      { reviewId, revision },
      { $set: { status: 'failed', error: error.slice(0, 300), attempts } },
    );
  },

  analysesForUser(userId: string, status?: 'done') {
    return ReviewAnalysisModel.find({ userId: oid(userId), ...(status ? { status } : {}) }).lean();
  },

  analysesForBooks(userId: string, bookIds: number[]) {
    return ReviewAnalysisModel.find({ userId: oid(userId), bookId: { $in: bookIds } }).lean();
  },

  async deleteAllForUser(userId: string): Promise<void> {
    const filter = { userId: oid(userId) };
    await Promise.all([
      OnboardingModel.deleteMany(filter),
      ReviewModel.deleteMany(filter),
      ReviewAnalysisModel.deleteMany(filter),
    ]);
  },
};
