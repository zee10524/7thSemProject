import { Schema, model, type InferSchemaType } from 'mongoose';

const onboardingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    picks: { type: [Number], default: [] },
    text: { type: String, default: '', maxlength: 1000 },
    /** Contract `OnboardingProfile`, validated with the shared Zod schema before it is stored. */
    profile: { type: Schema.Types.Mixed, required: true },
    displayChips: { type: [String], default: [] },
    method: { type: String, enum: ['llm', 'embed_only'], required: true },
  },
  { timestamps: true, minimize: false },
);
onboardingSchema.index({ userId: 1 }, { unique: true });
export type Onboarding = InferSchemaType<typeof onboardingSchema>;
export const OnboardingModel = model('OnboardingProfile', onboardingSchema);

const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true, min: 0 },
    text: { type: String, required: true, maxlength: 5000 },
    stars: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true },
);
reviewSchema.index({ userId: 1, bookId: 1 }, { unique: true });
reviewSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
export type Review = InferSchemaType<typeof reviewSchema>;
export const ReviewModel = model('Review', reviewSchema);

const reviewAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true, min: 0 },
    reviewId: { type: Schema.Types.ObjectId, required: true, ref: 'Review' },
    /** Review revision the analysis belongs to (review.updatedAt in ms); stale results are discarded. */
    revision: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'done', 'failed'], required: true },
    aspects: { type: Schema.Types.Mixed, default: {} },
    spoilerSentences: { type: Number, default: 0 },
    ts: { type: Number, required: true },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);
reviewAnalysisSchema.index({ userId: 1, bookId: 1 }, { unique: true });
reviewAnalysisSchema.index({ userId: 1, status: 1 });
export type ReviewAnalysisDocShape = InferSchemaType<typeof reviewAnalysisSchema>;
export const ReviewAnalysisModel = model('ReviewAnalysis', reviewAnalysisSchema);
