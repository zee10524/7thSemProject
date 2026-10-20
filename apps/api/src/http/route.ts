import type { Request, RequestHandler, Response, Router } from 'express';
import type { z } from 'zod';
import { errors } from '../lib/errors.js';
import type { CallContext } from '../modelService/index.js';
import { type AuthUser, callContext } from './context.js';
import { requireAuth, requireRole } from './middleware/security.js';

export type AuthMode = 'public' | 'optional' | 'user' | 'admin';
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface HandlerCtx<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  user: AuthUser | undefined;
  /** The signed-in user's id; throws 401 when there is none. */
  userId: () => string;
  call: CallContext;
  req: Request;
  res: Response;
}

export interface RouteSpec<B extends z.ZodType, Q extends z.ZodType, P extends z.ZodType> {
  method: Method;
  /** Express path relative to /api/v1, e.g. `/books/:bookId`. */
  path: string;
  summary: string;
  tag: string;
  auth: AuthMode;
  body?: B;
  query?: Q;
  params?: P;
  /** Response schema, for the OpenAPI document. */
  response?: z.ZodType;
  /** Success status; 204 when the handler returns undefined. */
  status?: number;
  /** Accepts an Idempotency-Key header (documented and enforced). */
  idempotent?: boolean;
  middleware?: RequestHandler[];
  handler: (ctx: HandlerCtx<z.output<B>, z.output<Q>, z.output<P>>) => Promise<unknown> | unknown;
}

// Erased form stored in the route table.
export interface AnyRoute {
  method: Method;
  path: string;
  summary: string;
  tag: string;
  auth: AuthMode;
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
  response?: z.ZodType;
  status?: number;
  idempotent?: boolean;
  middleware?: RequestHandler[];
  handler: (ctx: HandlerCtx<unknown, unknown, unknown>) => Promise<unknown> | unknown;
}

export function defineRoute<
  B extends z.ZodType = z.ZodUnknown,
  Q extends z.ZodType = z.ZodUnknown,
  P extends z.ZodType = z.ZodUnknown,
>(spec: RouteSpec<B, Q, P>): AnyRoute {
  return spec as unknown as AnyRoute;
}

function parse(schema: z.ZodType | undefined, value: unknown, where: string): unknown {
  if (!schema) return value;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw errors.validation(
      result.error.issues.slice(0, 20).map((i) => ({
        path: [where, ...i.path].join('.'),
        message: i.message,
        code: i.code,
      })),
    );
  }
  return result.data;
}

function guard(auth: AuthMode): RequestHandler[] {
  if (auth === 'user') return [requireAuth()];
  if (auth === 'admin') return [requireRole('admin')];
  return [];
}

/** Mounts a route table: auth guard, extra middleware, Zod-validated input, JSON or 204 output. */
export function mountRoutes(router: Router, routes: AnyRoute[], idempotency: RequestHandler): void {
  for (const route of routes) {
    const handler: RequestHandler = async (req, res) => {
      const ctx: HandlerCtx<unknown, unknown, unknown> = {
        body: parse(route.body, req.body ?? {}, 'body'),
        query: parse(route.query, req.query, 'query'),
        params: parse(route.params, req.params, 'params'),
        user: req.user,
        userId: () => {
          if (!req.user) throw errors.unauthenticated();
          return req.user.id;
        },
        call: callContext(req, res),
        req,
        res,
      };
      const result = await route.handler(ctx);
      if (res.headersSent) return;
      if (result === undefined) {
        res.status(204).end();
        return;
      }
      res.status(route.status ?? 200).json(result);
    };
    router[route.method](
      route.path,
      ...guard(route.auth),
      ...(route.middleware ?? []),
      ...(route.idempotent ? [idempotency] : []),
      handler,
    );
  }
}
