import { Types } from 'mongoose';
import { UserModel } from '../models/index.js';

const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

export const userRepository = {
  findById(id: string | Types.ObjectId) {
    return UserModel.findById(oid(id)).lean();
  },

  findByEmailWithSecrets(email: string) {
    return UserModel.findOne({ email: { $eq: email } })
      .select('+passwordHash +failedLogins +lockedUntil')
      .lean();
  },

  findByIdWithPassword(id: string | Types.ObjectId) {
    return UserModel.findById(oid(id)).select('+passwordHash').lean();
  },

  create(data: { email: string; passwordHash: string; name: string; role: 'user' | 'admin' }) {
    return UserModel.create(data);
  },

  async recordFailedLogin(
    id: Types.ObjectId,
    maxFailures: number,
    lockMinutes: number,
  ): Promise<Date | null> {
    const updated = await UserModel.findByIdAndUpdate(id, { $inc: { failedLogins: 1 } }, { new: true })
      .select('+failedLogins')
      .lean();
    if (updated && (updated.failedLogins ?? 0) >= maxFailures) {
      const until = new Date(Date.now() + lockMinutes * 60_000);
      await UserModel.updateOne({ _id: id }, { $set: { lockedUntil: until, failedLogins: 0 } });
      return until;
    }
    return null;
  },

  clearFailedLogins(id: Types.ObjectId) {
    return UserModel.updateOne({ _id: id }, { $set: { failedLogins: 0, lockedUntil: null } });
  },

  /** Increments and returns the profile version; called by every write that changes the UserState. */
  async bumpProfileVersion(id: string | Types.ObjectId): Promise<number> {
    const updated = await UserModel.findByIdAndUpdate(oid(id), { $inc: { profileVersion: 1 } }, { new: true })
      .select('profileVersion')
      .lean();
    return updated?.profileVersion ?? 0;
  },

  updateName(id: string, name: string) {
    return UserModel.findByIdAndUpdate(oid(id), { $set: { name } }, { new: true }).lean();
  },

  updateOverrides(
    id: string,
    patch: { mutedGenres?: string[]; pinnedAspects?: string[]; disabledAi?: boolean },
  ) {
    const set: Record<string, unknown> = {};
    if (patch.mutedGenres) set['overrides.mutedGenres'] = patch.mutedGenres;
    if (patch.pinnedAspects) set['overrides.pinnedAspects'] = patch.pinnedAspects;
    if (patch.disabledAi !== undefined) set['overrides.disabledAi'] = patch.disabledAi;
    return UserModel.findByIdAndUpdate(
      oid(id),
      { $set: set, $inc: { profileVersion: 1 } },
      { new: true },
    ).lean();
  },

  markOnboarded(id: string) {
    return UserModel.updateOne({ _id: oid(id), onboardedAt: null }, { $set: { onboardedAt: new Date() } });
  },

  deleteById(id: string) {
    return UserModel.deleteOne({ _id: oid(id) });
  },

  count() {
    return UserModel.estimatedDocumentCount();
  },
};
