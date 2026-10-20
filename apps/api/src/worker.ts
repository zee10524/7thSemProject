// Standalone BullMQ consumer for review analysis. Run it when WORKER_IN_PROCESS=false (scale it apart).
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { startReviewWorker } from './jobs/jobQueue.js';
import { connectMongo, disconnectMongo } from './lib/db.js';
import { createLogger } from './lib/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    pretty: !config.isProd && process.stdout.isTTY,
  }).child({
    component: 'worker',
  });
  if (!config.REDIS_URL)
    throw new Error('The worker needs REDIS_URL (without Redis the API runs jobs inline).');
  await connectMongo(config.MONGODB_URI, logger);
  const c = createContainer(config, logger, null);
  const worker = startReviewWorker(
    { url: config.REDIS_URL, maxRetriesPerRequest: null },
    c.reviewProcessor,
    logger,
  );
  logger.info({ modelMode: c.model.mode }, 'worker started');

  const shutdown = async () => {
    await worker.close();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
