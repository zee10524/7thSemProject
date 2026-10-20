import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { ErrorEnvelope } from '@litsense/shared';
import { z, type ZodObject, type ZodRawShape, type ZodType } from 'zod';
import { API_PREFIX, COOKIE } from './context.js';
import type { AnyRoute } from './route.js';

const IdempotencyHeader = z.object({ 'Idempotency-Key': z.string().min(8).max(200).optional() });

const ERRORS: Record<number, string> = {
  400: 'Invalid input (code BAD_REQUEST or VALIDATION_FAILED)',
  401: 'Not signed in',
  403: 'Forbidden or CSRF token missing',
  404: 'Not found',
  409: 'Conflict',
  429: 'Rate limited',
  502: 'Model service sent an unexpected answer',
  503: 'Model service unavailable (circuit open or down)',
};

function asObject(schema: ZodType | undefined): ZodObject<ZodRawShape> | undefined {
  return schema && 'shape' in schema ? (schema as ZodObject<ZodRawShape>) : undefined;
}

/** Builds the OpenAPI 3.1 document from the same route table the router uses, so they cannot drift. */
export function buildOpenApi(routes: AnyRoute[]): object {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: COOKIE.access,
  });
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.registerComponent('securitySchemes', 'csrf', {
    type: 'apiKey',
    in: 'header',
    name: 'X-CSRF-Token',
  });

  for (const r of routes) {
    const unsafe = r.method !== 'get';
    const security: Record<string, string[]>[] = [];
    if (r.auth === 'user' || r.auth === 'admin') {
      security.push(unsafe ? { cookieAuth: [], csrf: [] } : { cookieAuth: [] }, { bearerAuth: [] });
    } else if (unsafe) {
      security.push({ csrf: [] });
    }
    const success = r.status ?? (r.response ? 200 : 204);
    const errorResponses = Object.fromEntries(
      Object.entries(ERRORS)
        .filter(([code]) => (code === '401' || code === '403' ? r.auth !== 'public' || unsafe : true))
        .map(([code, description]) => [
          code,
          { description, content: { 'application/json': { schema: ErrorEnvelope } } },
        ]),
    );
    registry.registerPath({
      method: r.method,
      path: API_PREFIX + r.path.replace(/:([A-Za-z]+)/g, '{$1}'),
      summary: r.summary,
      tags: [r.tag],
      ...(security.length ? { security } : {}),
      request: {
        ...(asObject(r.params) ? { params: asObject(r.params) } : {}),
        ...(asObject(r.query) ? { query: asObject(r.query) } : {}),
        ...(r.body ? { body: { content: { 'application/json': { schema: r.body } } } } : {}),
        ...(r.idempotent ? { headers: IdempotencyHeader } : {}),
      },
      responses: {
        [success]: r.response
          ? { description: 'OK', content: { 'application/json': { schema: r.response } } }
          : { description: 'No content' },
        ...errorResponses,
      },
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'LitSense API',
      version: '0.1.0',
      description:
        'Backend for the LitSense web app. Cookie auth with rotating refresh tokens; unsafe requests need X-CSRF-Token from GET /auth/csrf. Errors use { error: { code, message, details?, requestId } }.',
    },
    servers: [{ url: '/' }],
  });
}
