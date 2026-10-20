import { Schema, model, type InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    family: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true },
);
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1, family: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);

const idempotencySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    key: { type: String, required: true, maxlength: 200 },
    method: { type: String, required: true },
    path: { type: String, required: true },
    requestHash: { type: String, required: true },
    state: { type: String, enum: ['in_progress', 'done'], required: true },
    status: { type: Number, default: null },
    body: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false, minimize: false },
);
idempotencySchema.index({ userId: 1, key: 1 }, { unique: true });
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
export const IdempotencyKeyModel = model('IdempotencyKey', idempotencySchema);
