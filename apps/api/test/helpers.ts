import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config/env.js';
import { type Container, type ContainerOverrides, createContainer } from '../src/container.js';
import { createLogger } from '../src/lib/logger.js';
import '../src/models/index.js';

export const API = '/api/v1';

export interface TestApp {
  app: Express;
  c: Container;
  config: AppConfig;
}

export function testConfig(env: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    MONGODB_URI: 'mongodb://unused',
    JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0001',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '1000',
    CHAT_RATE_LIMIT_MAX: '1000',
    ADMIN_EMAILS: 'admin@litsense.test',
    SEED_ON_BOOT: 'false',
    ...env,
  });
}

/** Connects to a fresh database on the shared in-memory server, seeds the fixture catalogue, builds the app. */
export function useTestApp(
  opts: { env?: Record<string, string>; overrides?: ContainerOverrides } = {},
): TestApp {
  const holder = {} as TestApp;
  beforeAll(async () => {
    const base = process.env.TEST_MONGO_URI;
    if (!base) throw new Error('TEST_MONGO_URI missing; is globalSetup configured?');
    await mongoose.connect(`${base.replace(/\/$/, '')}/t_${randomUUID().slice(0, 8)}`, { autoIndex: false });
    await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
    const config = testConfig(opts.env);
    const c = createContainer(config, createLogger({ level: 'silent' }), null, opts.overrides);
    await c.seed.seed({ source: 'fixture' });
    holder.config = config;
    holder.c = c;
    holder.app = createApp(c);
  });
  afterAll(async () => {
    await holder.c?.jobs.close();
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  });
  return holder;
}

/** A signed-in browser-like client: cookie jar plus the CSRF token the SPA would keep in memory. */
export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  userId: string;
  email: string;
  password: string;
  get(path: string): request.Test;
  post(path: string, body?: object): request.Test;
  put(path: string, body?: object): request.Test;
  patch(path: string, body?: object): request.Test;
  del(path: string, body?: object): request.Test;
}

export async function csrfFor(agent: ReturnType<typeof request.agent>): Promise<string> {
  const res = await agent.get(`${API}/auth/csrf`).expect(200);
  return res.body.csrfToken as string;
}

export function wrap(
  agent: ReturnType<typeof request.agent>,
  s: Omit<Session, 'get' | 'post' | 'put' | 'patch' | 'del' | 'agent'>,
): Session {
  const session: Session = {
    ...s,
    agent,
    get: (p) => agent.get(API + p),
    post: (p, b) =>
      agent
        .post(API + p)
        .set('X-CSRF-Token', session.csrf)
        .send(b ?? {}),
    put: (p, b) =>
      agent
        .put(API + p)
        .set('X-CSRF-Token', session.csrf)
        .send(b ?? {}),
    patch: (p, b) =>
      agent
        .patch(API + p)
        .set('X-CSRF-Token', session.csrf)
        .send(b ?? {}),
    del: (p, b) =>
      agent
        .delete(API + p)
        .set('X-CSRF-Token', session.csrf)
        .send(b ?? {}),
  };
  return session;
}

export async function signUp(app: Express, opts: { email?: string; name?: string } = {}): Promise<Session> {
  const agent = request.agent(app);
  const csrf = await csrfFor(agent);
  const email = opts.email ?? `reader-${randomUUID().slice(0, 8)}@litsense.test`;
  const password = 'correct horse 42';
  const res = await agent
    .post(`${API}/auth/register`)
    .set('X-CSRF-Token', csrf)
    .send({ email, password, name: opts.name ?? 'Maya' })
    .expect(201);
  return wrap(agent, { csrf: res.body.csrfToken, userId: res.body.user.id, email, password });
}

/** Book ids in the fixture catalogue (prototype order). */
export const BOOK = {
  projectHailMary: 0,
  songOfAchilles: 1,
  klaraAndTheSun: 2,
  theMartian: 12,
  circe: 13,
  anxiousPeople: 15,
  normalPeople: 38,
  fellowship: 40,
  twoTowers: 41,
  returnOfTheKing: 42,
} as const;
