import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const list = z.string().transform((s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/litsense'),
    REDIS_URL: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    ACCESS_TOKEN_TTL_S: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    CORS_ORIGINS: list.default(['http://localhost:5173', 'http://localhost:8080']),
    COOKIE_SECURE: bool.optional(),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),
    ADMIN_EMAILS: list.default([]),

    MODEL_SERVICE_MODE: z.enum(['mock', 'http']).default('mock'),
    MODEL_SERVICE_URL: z.url().optional(),
    MODEL_SERVICE_KEY: z.string().optional(),
    MODEL_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(100).default(4000),
    MODEL_SERVICE_SLOW_TIMEOUT_MS: z.coerce.number().int().min(100).default(15000),
    MODEL_SERVICE_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(5),
    BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1000).default(30000),

    CACHE_TTL_S: z.coerce.number().int().min(1).default(600),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    CHAT_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
    LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),

    WORKER_IN_PROCESS: bool.default(true),
    SEED_ON_BOOT: bool.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.MODEL_SERVICE_MODE === 'http') {
      if (!env.MODEL_SERVICE_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['MODEL_SERVICE_URL'],
          message: 'required when MODEL_SERVICE_MODE=http',
        });
      }
      if (!env.MODEL_SERVICE_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['MODEL_SERVICE_KEY'],
          message: 'required when MODEL_SERVICE_MODE=http',
        });
      }
    }
    if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'set a real secret in production',
      });
    }
    if (env.COOKIE_SAMESITE === 'none' && env.COOKIE_SECURE === false) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'SameSite=None requires Secure cookies',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export interface AppConfig extends Env {
  isProd: boolean;
  isTest: boolean;
  cookieSecure: boolean;
  usingDevSecret: boolean;
}

/** Loads `.env` (if present, never overriding real env vars) and validates everything once. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  if (source === process.env) {
    for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
      if (existsSync(file)) loadDotenv({ path: file, quiet: true });
    }
  }
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  return {
    ...env,
    isProd,
    isTest: env.NODE_ENV === 'test',
    cookieSecure: env.COOKIE_SECURE ?? isProd,
    usingDevSecret: env.JWT_ACCESS_SECRET === DEV_JWT_SECRET,
  };
}
