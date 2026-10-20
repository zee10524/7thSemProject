import { Schema, model, type InferSchemaType } from 'mongoose';
import { LIST_STATUSES } from '@litsense/shared';

const ratingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true, min: 0 },
    stars: { type: Number, required: true, min: 1, max: 5 },
    ratedAt: { type: Date, required: true },
  },
  { timestamps: false },
);
ratingSchema.index({ userId: 1, bookId: 1 }, { unique: true });
ratingSchema.index({ userId: 1, ratedAt: -1, _id: -1 });
export type Rating = InferSchemaType<typeof ratingSchema>;
export const RatingModel = model('Rating', ratingSchema);

const readingListSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true, min: 0 },
    status: { type: String, enum: LIST_STATUSES, required: true },
    progress: { type: Number, min: 0, max: 100, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    updatedAt: { type: Date, required: true },
  },
  { timestamps: false },
);
readingListSchema.index({ userId: 1, bookId: 1 }, { unique: true });
readingListSchema.index({ userId: 1, status: 1, updatedAt: -1, _id: -1 });
readingListSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
export type ReadingListEntry = InferSchemaType<typeof readingListSchema>;
export const ReadingListModel = model('ReadingListEntry', readingListSchema);

const dismissalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true, min: 0 },
    dismissedAt: { type: Date, required: true },
  },
  { timestamps: false },
);
dismissalSchema.index({ userId: 1, bookId: 1 }, { unique: true });
dismissalSchema.index({ userId: 1, dismissedAt: -1, _id: -1 });
export const DismissalModel = model('Dismissal', dismissalSchema);

const viewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true, min: 0 },
    viewedAt: { type: Date, required: true },
  },
  { timestamps: false },
);
viewSchema.index({ userId: 1, bookId: 1 }, { unique: true });
viewSchema.index({ userId: 1, viewedAt: -1 });
// Old views stop mattering for "continue exploring"; let Mongo drop them.
viewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });
export const ViewModel = model('View', viewSchema);
