import type { ErrorCode } from '@litsense/shared';

/** An error that maps to a stable HTTP error envelope. Messages are safe to show to users. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  badRequest: (message = 'The request is not valid.', details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  validation: (details: unknown) =>
    new AppError(400, 'VALIDATION_FAILED', 'Some fields are not valid.', details),
  unauthenticated: (message = 'Please sign in.') => new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have access to this.') => new AppError(403, 'FORBIDDEN', message),
  csrf: () => new AppError(403, 'CSRF_FAILED', 'Your session token is missing or stale. Refresh the page.'),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`),
  conflict: (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details),
  locked: (retryAfterS: number) =>
    new AppError(
      423,
      'ACCOUNT_LOCKED',
      'Too many failed sign-ins. Try again later.',
      { retryAfterS },
      {
        'Retry-After': String(retryAfterS),
      },
    ),
  modelUnavailable: (message = 'The recommendation engine is unavailable. Try again shortly.') =>
    new AppError(503, 'MODEL_UNAVAILABLE', message, undefined, { 'Retry-After': '15' }),
  modelBadResponse: (message = 'The recommendation engine sent an unexpected answer.') =>
    new AppError(502, 'MODEL_BAD_RESPONSE', message),
};
