import { Schema, model, type InferSchemaType } from 'mongoose';

const chatSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, default: 'New conversation', maxlength: 120 },
    /** Contract `SessionState`, stored exactly as the core returned it (null before the first turn). */
    state: { type: Schema.Types.Mixed, default: null },
    /** Rendered transcript: user messages and hydrated assistant replies (ChatTurnDto without books). */
    turns: { type: [Schema.Types.Mixed], default: [] },
    chips: { type: [Schema.Types.Mixed], default: [] },
    /** Optimistic lock: every write is conditional on the version it read. */
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true, minimize: false },
);
chatSessionSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
// Conversations idle for 30 days are deleted.
chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export type ChatSession = InferSchemaType<typeof chatSessionSchema>;
export const ChatSessionModel = model('ChatSession', chatSessionSchema);

const explanationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    bookId: { type: Number, required: true },
    profileVersion: { type: Number, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false, minimize: false },
);
explanationSchema.index({ userId: 1, bookId: 1, profileVersion: 1 }, { unique: true });
explanationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });
export const ExplanationModel = model('Explanation', explanationSchema);
