import type { Server } from 'node:http';
import type { Worker } from 'bullmq';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { startReviewWorker } from './jobs/jobQueue.js';
import { connectMongo, disconnectMongo } from './lib/db.js';
import { createLogger } from './lib/logger.js';
import { createRedis } from './lib/redis.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.LOG_LEVEL, pretty: !config.isProd && process.stdout.isTTY });
  if (config.usingDevSecret) logger.warn('JWT_ACCESS_SECRET is the development default; set a real secret');

  await connectMongo(config.MONGODB_URI, logger);
  const redis = createRedis(config.REDIS_URL, logger);
  const c = createContainer(config, logger, redis);
  logger.info({ modelMode: c.model.mode, cache: c.cache.kind, jobs: c.jobs.kind }, 'container ready');

  if (config.SEED_ON_BOOT) {
    await c.seed
      .seedIfEmpty()
      .catch((err: Error) => logger.error({ err: err.message }, 'catalogue seed on boot failed'));
  }

  let worker: Worker | null = null;
  if (redis && config.WORKER_IN_PROCESS) {
    worker = startReviewWorker(
      { url: config.REDIS_URL ?? '', maxRetriesPerRequest: null },
      c.reviewProcessor,
      logger,
    );
    logger.info('review-analysis worker running in-process');
  }

  const app = createApp(c);
  const server: Server = app.listen(config.PORT, config.HOST, () => {
    logger.info({ port: config.PORT }, 'api listening');
  });
  server.keepAliveTimeout = 65_000; // longer than typical load-balancer idle timeouts
  server.headersTimeout = 66_000;
  server.requestTimeout = 60_000;

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => {
      logger.error('forced exit after 15 s');
      process.exit(1);
    }, 15_000);
    force.unref();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server.closeIdleConnections();
    await worker?.close().catch(() => undefined);
    await c.jobs.close().catch(() => undefined);
    await redis?.quit().catch(() => undefined);
    await disconnectMongo().catch(() => undefined);
    logger.info('bye');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
