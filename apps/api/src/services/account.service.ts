import { Types } from 'mongoose';
import type { UserDto } from '@litsense/shared';
import { errors } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import type { User } from '../models/index.js';
import { authRepository } from '../repositories/auth.repository.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';

type UserRow = Partial<User> & { _id: Types.ObjectId; email: string; name: string };

export function toUserDto(u: UserRow): UserDto {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    role: u.role === 'admin' ? 'admin' : 'user',
    onboarded: Boolean(u.onboardedAt),
    overrides: {
      mutedGenres: u.overrides?.mutedGenres ?? [],
      pinnedAspects: u.overrides?.pinnedAspects ?? [],
      disabledAi: u.overrides?.disabledAi ?? false,
    },
    profileVersion: u.profileVersion ?? 0,
    createdAt: (u.createdAt ?? new Date()).toISOString(),
  };
}

export class AccountService {
  constructor(
    private readonly verifyPassword: (hash: string, password: string) => Promise<boolean>,
    private readonly logger: Logger,
  ) {}

  async me(userId: string): Promise<UserDto> {
    const user = await userRepository.findById(userId);
    if (!user) throw errors.unauthenticated('Your account no longer exists.');
    return toUserDto(user);
  }

  async updateName(userId: string, name: string): Promise<UserDto> {
    const user = await userRepository.updateName(userId, name);
    if (!user) throw errors.unauthenticated();
    return toUserDto(user);
  }

  async updateOverrides(
    userId: string,
    patch: { mutedGenres?: string[]; pinnedAspects?: string[]; disabledAi?: boolean },
  ): Promise<UserDto> {
    const dedupe = (xs?: string[]) => (xs ? [...new Set(xs)] : undefined);
    const user = await userRepository.updateOverrides(userId, {
      mutedGenres: dedupe(patch.mutedGenres),
      pinnedAspects: dedupe(patch.pinnedAspects),
      disabledAi: patch.disabledAi,
    });
    if (!user) throw errors.unauthenticated();
    return toUserDto(user);
  }

  /** Deletes the account and everything that belongs to it. Requires the current password. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) throw errors.unauthenticated();
    if (!(await this.verifyPassword(user.passwordHash, password))) {
      throw errors.forbidden('The password is not correct.');
    }
    await Promise.all([
      libraryRepository.deleteAllForUser(userId),
      profileRepository.deleteAllForUser(userId),
      chatRepository.deleteAllForUser(userId),
      authRepository.deleteAllForUser(new Types.ObjectId(userId)),
    ]);
    await userRepository.deleteById(userId);
    this.logger.info({ userId }, 'account deleted');
  }
}
