import type { Request, Response } from 'express';
import type { Role } from '@litsense/shared';
import type { CallContext } from '../modelService/index.js';

export interface AuthUser {
  id: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    user?: AuthUser;
    /** True when the access token came from a cookie (CSRF applies) rather than a Bearer header. */
    cookieAuth?: boolean;
    /** Reader pseudonym forwarded to the model service as X-Client-Id. */
    clientId?: string;
  }
}

export const COOKIE = {
  access: 'ls_at',
  refresh: 'ls_rt',
  csrf: 'ls_csrf',
} as const;

export const API_PREFIX = '/api/v1';

/** Model-service call context; aborts the upstream call when the client goes away before the answer. */
export function callContext(req: Request, res: Response): CallContext {
  const controller = new AbortController();
  res.once('close', () => {
    if (!res.writableFinished) controller.abort(new Error('client closed the connection'));
  });
  return { requestId: req.id, clientId: req.clientId, signal: controller.signal };
}
