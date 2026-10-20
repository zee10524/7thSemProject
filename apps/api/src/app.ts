import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import type { ReadinessResponse } from '@litsense/shared';
import type { Container } from './container.js';
import { API_PREFIX } from './http/context.js';
import { authRoutes } from './http/controllers/auth.controller.js';
import { discoveryRoutes } from './http/controllers/discovery.controller.js';
import { libraryRoutes } from './http/controllers/library.controller.js';
import { errorHandler, notFoundHandler } from './http/middleware/errors.js';
import { idempotency } from './http/middleware/idempotency.js';
import { authenticate, csrfProtection, rateLimiters, requestId } from './http/middleware/security.js';
import { buildOpenApi } from './http/openapi.js';
import { type AnyRoute, mountRoutes } from './http/route.js';

export function buildRoutes(c: Container, limiters: ReturnType<typeof rateLimiters>): AnyRoute[] {
  return [...authRoutes(c, limiters.auth), ...libraryRoutes(c), ...discoveryRoutes(c, limiters.chat)];
}

export function createApp(c: Container): Express {
  const { config, logger } = c;
  const app = express();
  const started = Date.now();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.set('query parser', 'simple');

  app.use(requestId());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  // The API only returns JSON, so the strictest CSP applies; /docs gets its own below.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.CORS_ORIGINS.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id', 'Idempotency-Key', 'Authorization'],
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'Idempotent-Replayed'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // ---------------------------------------------------------------- health
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptimeS: Math.round((Date.now() - started) / 1000) });
  });
  app.get('/readyz', async (req, res) => {
    const checks: ReadinessResponse['checks'] = {};
    checks.mongo = { ok: mongoose.connection.readyState === 1 };
    if (c.redis) {
      checks.redis = await c.redis
        .ping()
        .then(() => ({ ok: true }))
        .catch((err: Error) => ({ ok: false, detail: err.message }));
    }
    const breaker = c.breaker.snapshot();
    checks.model = await c.model
      .health({ requestId: req.id })
      .then(() => ({ ok: true, detail: `${c.model.mode}, breaker ${breaker.state}` }))
      .catch(() => ({ ok: false, detail: `${c.model.mode}, breaker ${breaker.state}` }));
    // The app still serves accounts and shelves when the model service is down: degraded, not unready.
    const status =
      !checks.mongo.ok || checks.redis?.ok === false ? 'not_ready' : checks.model.ok ? 'ready' : 'degraded';
    res.status(status === 'not_ready' ? 503 : 200).json({ status, checks } satisfies ReadinessResponse);
  });

  // ---------------------------------------------------------------- API
  const limiters = rateLimiters(config, c.redis);
  const routes = buildRoutes(c, limiters);
  const openapi = buildOpenApi(routes);
  app.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  app.use(
    '/docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          upgradeInsecureRequests: null,
        },
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(openapi, { customSiteTitle: 'LitSense API' }),
  );

  const api = express.Router();
  api.use(limiters.global);
  api.use(authenticate(c.tokens));
  api.use(csrfProtection(c.tokens, config.CORS_ORIGINS));
  mountRoutes(api, routes, idempotency(logger));
  app.use(API_PREFIX, api);

  app.use(notFoundHandler());
  app.use(errorHandler(logger));
  return app;
}
