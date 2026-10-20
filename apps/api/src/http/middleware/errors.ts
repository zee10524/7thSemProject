import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import type { ErrorEnvelope } from '@litsense/shared';
import { AppError, errors } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { ModelServiceError } from '../../modelService/index.js';

export function zodDetails(err: ZodError) {
  return err.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }));
}

/** Maps any thrown error to the stable envelope `{ error: { code, message, details?, requestId } }`. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return errors.validation(zodDetails(err));
  if (err instanceof ModelServiceError) {
    return err.kind === 'unavailable' ? errors.modelUnavailable() : errors.modelBadResponse();
  }
  if (err instanceof mongoose.Error.CastError) return errors.badRequest('A value has the wrong type.');
  if (err instanceof mongoose.Error.ValidationError) {
    return errors.validation(Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })));
  }
  if ((err as { code?: number })?.code === 11000) return errors.conflict('That already exists.');
  const type = (err as { type?: string })?.type;
  if (type === 'entity.parse.failed') return errors.badRequest('The request body is not valid JSON.');
  if (type === 'entity.too.large')
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  return new AppError(500, 'INTERNAL', 'Something went wrong on our side.');
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const appErr = toAppError(err);
    if (appErr.status >= 500) {
      logger.error({ err, requestId: req.id, path: req.path }, 'request failed');
    } else if (err instanceof ModelServiceError) {
      logger.warn({ op: err.operation, kind: err.kind, requestId: req.id }, 'model service problem');
    }
    if (res.headersSent) return;
    for (const [k, v] of Object.entries(appErr.headers ?? {})) res.setHeader(k, v);
    const body: ErrorEnvelope = {
      error: {
        code: appErr.code,
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
        requestId: req.id,
      },
    };
    res.status(appErr.status).json(body);
  };
}

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => next(errors.notFound('Route'));
}
