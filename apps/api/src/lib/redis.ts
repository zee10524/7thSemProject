import { Redis } from 'ioredis';
import type { Logger } from './logger.js';

/** Creates an ioredis client, or null when REDIS_URL is not set. */
export function createRedis(
  url: string | undefined,
  logger: Logger,
  opts: { forBullmq?: boolean } = {},
): Redis | null {
  if (!url) return null;
  const client = new Redis(url, {
    lazyConnect: false,
    enableOfflineQueue: true,
    // BullMQ workers need blocking commands without a per-request retry cap.
    maxRetriesPerRequest: opts.forBullmq ? null : 2,
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  });
  client.on('error', (err: Error) => logger.warn({ err: err.message }, 'redis error'));
  return client;
}
