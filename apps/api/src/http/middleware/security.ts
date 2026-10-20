import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit, type Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../../config/env.js';
import { AppError, errors } from '../../lib/errors.js';
import { safeEqual } from '../../lib/hash.js';
import type { TokenService } from '../../services/token.service.js';
import { COOKIE } from '../context.js';

// Same alphabet and length the model service accepts, so the id survives the hop unchanged.
const REQUEST_ID = /^[A-Za-z0-9._:-]{8,64}$/;

/** Accepts a well-formed incoming X-Request-Id (for tracing across services) or makes one. */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}

/** Reads the access token (httpOnly cookie, or a Bearer header for API clients) and sets req.user. */
export function authenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.get('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE.access];
    const token = bearer ?? cookie;
    if (token) {
      const claims = tokens.verifyAccess(token);
      if (claims) {
        req.user = { id: claims.sub, role: claims.role };
        req.cookieAuth = !bearer;
        req.clientId = tokens.pseudonym(claims.sub);
      }
    }
    next();
  };
}

export function requireAuth(): RequestHandler {
  return (req, _res, next) => next(req.user ? undefined : errors.unauthenticated());
}

export function requireRole(role: 'admin'): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    if (req.user.role !== role) return next(errors.forbidden());
    next();
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF for cookie auth: synchronizer token (signed, stored in an httpOnly cookie, echoed by the SPA
 * in X-CSRF-Token) plus an Origin allowlist check. Bearer-token requests carry no ambient credential
 * and skip the check.
 */
export function csrfProtection(tokens: TokenService, allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const header = req.get('authorization');
    if (header?.startsWith('Bearer ')) return next();
    const origin = req.get('origin');
    if (origin && !allowed.has(origin)) return next(errors.csrf());
    const sent = req.get('x-csrf-token');
    const stored = (req.cookies as Record<string, string> | undefined)?.[COOKIE.csrf];
    if (!sent || !stored || !safeEqual(sent, stored) || !tokens.isValidCsrfToken(sent))
      return next(errors.csrf());
    next();
  };
}

function storeFor(redis: Redis | null, prefix: string): Store | undefined {
  if (!redis) return undefined;
  return new RedisStore({
    prefix: `ls:rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
  });
}

function limiter(opts: {
  windowMs: number;
  limit: number;
  redis: Redis | null;
  prefix: string;
  key?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: storeFor(opts.redis, opts.prefix),
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    ...(opts.key ? { keyGenerator: opts.key } : {}),
    handler: (_req: Request, _res: Response, next: NextFunction, options) => {
      next(
        new AppError(429, 'RATE_LIMITED', 'Too many requests. Slow down and try again shortly.', undefined, {
          'Retry-After': String(Math.ceil(options.windowMs / 1000)),
        }),
      );
    },
  });
}

export function rateLimiters(config: AppConfig, redis: Redis | null) {
  return {
    global: limiter({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.RATE_LIMIT_MAX,
      redis,
      prefix: 'global',
    }),
    /** Per IP on sign-in and sign-up, counting only failures, on top of the per-account lockout. */
    auth: limiter({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.AUTH_RATE_LIMIT_MAX,
      redis,
      prefix: 'auth',
      skipSuccessfulRequests: true,
    }),
    /** Per user on chat turns (each can cost LLM calls on the model service). */
    chat: limiter({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.CHAT_RATE_LIMIT_MAX,
      redis,
      prefix: 'chat',
      key: (req) => (req.user ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`),
    }),
  };
}
