// npm run openapi -w @litsense/api  ->  apps/api/openapi.json (committed, for clients and review)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRoutes } from '../app.js';
import { loadConfig } from '../config/env.js';
import { createContainer } from '../container.js';
import { rateLimiters } from '../http/middleware/security.js';
import { buildOpenApi } from '../http/openapi.js';
import { createLogger } from '../lib/logger.js';

const config = loadConfig({ NODE_ENV: 'development', MODEL_SERVICE_MODE: 'mock' });
const logger = createLogger({ level: 'silent' });
const c = createContainer(config, logger, null);
const doc = buildOpenApi(buildRoutes(c, rateLimiters(config, null)));
const out = resolve(process.cwd(), 'openapi.json');
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.log(`wrote ${out}`);
