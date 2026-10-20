// npm run seed [-- --source=fixture|model] [--reset]
// Pulls the catalogue from the model service (/v1/catalog) or the bundled fixture into MongoDB.
import { loadConfig } from '../config/env.js';
import { createContainer } from '../container.js';
import { connectMongo, disconnectMongo } from '../lib/db.js';
import { createLogger } from '../lib/logger.js';

const args = process.argv.slice(2);
const sourceArg = args.find((a) => a.startsWith('--source='))?.split('=')[1];
if (sourceArg && sourceArg !== 'model' && sourceArg !== 'fixture') {
  console.error('--source must be model or fixture');
  process.exit(2);
}

const config = loadConfig();
const logger = createLogger({ level: 'info', pretty: process.stdout.isTTY });
await connectMongo(config.MONGODB_URI, logger);
try {
  const c = createContainer(config, logger, null);
  const result = await c.seed.seed({
    source: sourceArg as 'model' | 'fixture' | undefined,
    reset: args.includes('--reset'),
  });
  logger.info(result, 'seed finished');
} catch (err) {
  logger.error({ err: (err as Error).message }, 'seed failed');
  process.exitCode = 1;
} finally {
  await disconnectMongo();
}
