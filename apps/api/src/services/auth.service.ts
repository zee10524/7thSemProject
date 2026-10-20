import { hash, type Options, verify } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import type { UserDto } from '@litsense/shared';
import type { AppConfig } from '../config/env.js';
import { errors } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { authRepository } from '../repositories/auth.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { toUserDto } from './account.service.js';
import type { TokenService } from './token.service.js';

/** OWASP Password Storage Cheat Sheet minimum for argon2id. */
// algorithm 2 is Algorithm.Argon2id (a const enum, which verbatimModuleSyntax cannot import).
const ARGON2: Options = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: UserDto;
  tokens: SessionTokens;
}

const BAD_CREDENTIALS = 'Email or password is incorrect.';

export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly tokens: TokenService,
    private readonly logger: Logger,
  ) {}

  hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2);
  }

  verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password).catch(() => false);
  }

  async register(
    input: { email: string; password: string; name: string },
    userAgent: string | null,
  ): Promise<AuthResult> {
    const existing = await userRepository.findByEmailWithSecrets(input.email);
    if (existing) throw errors.conflict('An account with this email already exists.');
    const role = this.config.ADMIN_EMAILS.includes(input.email) ? 'admin' : 'user';
    let doc;
    try {
      doc = await userRepository.create({
        email: input.email,
        name: input.name,
        role,
        passwordHash: await this.hashPassword(input.password),
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw errors.conflict('An account with this email already exists.');
      throw err;
    }
    this.logger.info({ userId: String(doc._id), role }, 'user registered');
    const user = toUserDto(doc.toObject());
    return { user, tokens: await this.startSession(doc._id, user.role, userAgent) };
  }

  async login(input: { email: string; password: string }, userAgent: string | null): Promise<AuthResult> {
    const user = await userRepository.findByEmailWithSecrets(input.email);
    if (!user) {
      // Same work as a real check, so response time does not reveal which emails exist.
      await this.verifyPassword(await this.getDummyHash(), input.password);
      throw errors.unauthenticated(BAD_CREDENTIALS);
    }
    const now = Date.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      throw errors.locked(Math.ceil((user.lockedUntil.getTime() - now) / 1000));
    }
    const ok = await this.verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      const lockedUntil = await userRepository.recordFailedLogin(
        user._id,
        this.config.LOGIN_MAX_FAILURES,
        this.config.LOGIN_LOCK_MINUTES,
      );
      if (lockedUntil) {
        this.logger.warn({ userId: String(user._id) }, 'account locked after repeated failed sign-ins');
        throw errors.locked(this.config.LOGIN_LOCK_MINUTES * 60);
      }
      throw errors.unauthenticated(BAD_CREDENTIALS);
    }
    if (user.failedLogins || user.lockedUntil) await userRepository.clearFailedLogins(user._id);
    const dto = toUserDto(user);
    return { user: dto, tokens: await this.startSession(user._id, dto.role, userAgent) };
  }

  /** Rotates a refresh token. Presenting an already-rotated token revokes the whole family. */
  async refresh(rawToken: string | undefined, userAgent: string | null): Promise<AuthResult> {
    if (!rawToken) throw errors.unauthenticated();
    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const current = await authRepository.findRefreshToken(tokenHash);
    if (!current) throw errors.unauthenticated();
    if (current.revokedAt) {
      await authRepository.revokeFamily(current.userId, current.family);
      this.logger.warn({ userId: String(current.userId) }, 'refresh token reuse detected; family revoked');
      throw errors.unauthenticated('Your session ended. Please sign in again.');
    }
    if (current.expiresAt.getTime() <= Date.now()) throw errors.unauthenticated('Your session expired.');

    const next = this.tokens.newRefreshToken();
    const revoked = await authRepository.revokeIfActive(tokenHash, next.hash);
    if (!revoked) {
      await authRepository.revokeFamily(current.userId, current.family);
      throw errors.unauthenticated('Your session ended. Please sign in again.');
    }
    const user = await userRepository.findById(current.userId);
    if (!user) throw errors.unauthenticated();
    await authRepository.createRefreshToken({
      userId: current.userId,
      family: current.family,
      tokenHash: next.hash,
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    const dto = toUserDto(user);
    return {
      user: dto,
      tokens: {
        accessToken: this.tokens.signAccess({ sub: dto.id, role: dto.role }),
        refreshToken: next.raw,
      },
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await authRepository.revokeIfActive(this.tokens.hashRefreshToken(rawToken), null);
  }

  async logoutAll(userId: string): Promise<void> {
    await authRepository.revokeAllForUser(new Types.ObjectId(userId));
  }

  private async startSession(
    userId: Types.ObjectId,
    role: 'user' | 'admin',
    userAgent: string | null,
  ): Promise<SessionTokens> {
    const refresh = this.tokens.newRefreshToken();
    await authRepository.createRefreshToken({
      userId,
      family: randomUUID(),
      tokenHash: refresh.hash,
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    return { accessToken: this.tokens.signAccess({ sub: String(userId), role }), refreshToken: refresh.raw };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hashPassword(`dummy-${randomUUID()}`);
    return this.dummyHash;
  }
}
