import { type Types } from 'mongoose';
import { IdempotencyKeyModel, RefreshTokenModel } from '../models/index.js';

export const authRepository = {
  createRefreshToken(data: {
    userId: Types.ObjectId;
    family: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  }) {
    return RefreshTokenModel.create(data);
  },

  findRefreshToken(tokenHash: string) {
    return RefreshTokenModel.findOne({ tokenHash: { $eq: tokenHash } }).lean();
  },

  /** Atomically revokes a live token. Returns null if it was already revoked (a reuse or a race). */
  revokeIfActive(tokenHash: string, replacedByHash: string | null) {
    return RefreshTokenModel.findOneAndUpdate(
      { tokenHash: { $eq: tokenHash }, revokedAt: null },
      { $set: { revokedAt: new Date(), replacedByHash } },
      { new: true },
    ).lean();
  },

  revokeFamily(userId: Types.ObjectId, family: string) {
    return RefreshTokenModel.updateMany(
      { userId, family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  },

  revokeAllForUser(userId: Types.ObjectId) {
    return RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  deleteAllForUser(userId: Types.ObjectId) {
    return Promise.all([
      RefreshTokenModel.deleteMany({ userId }),
      IdempotencyKeyModel.deleteMany({ userId }),
    ]);
  },

  // ---------------------------------------------------------------- idempotency keys
  findIdempotencyKey(userId: Types.ObjectId, key: string) {
    return IdempotencyKeyModel.findOne({ userId, key: { $eq: key } }).lean();
  },

  /** Inserts the in-progress marker; false if the key already exists. */
  async claimIdempotencyKey(data: {
    userId: Types.ObjectId;
    key: string;
    method: string;
    path: string;
    requestHash: string;
  }): Promise<boolean> {
    try {
      await IdempotencyKeyModel.create({ ...data, state: 'in_progress', createdAt: new Date() });
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return false;
      throw err;
    }
  },

  completeIdempotencyKey(userId: Types.ObjectId, key: string, status: number, body: unknown) {
    return IdempotencyKeyModel.updateOne({ userId, key }, { $set: { state: 'done', status, body } });
  },

  releaseIdempotencyKey(userId: Types.ObjectId, key: string) {
    return IdempotencyKeyModel.deleteOne({ userId, key, state: 'in_progress' });
  },
};
