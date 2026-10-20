import pino, { type Logger } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'headers["x-api-key"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.csrfToken',
];

export function createLogger(opts: { level: string; pretty?: boolean }): Logger {
  return pino({
    level: opts.level,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'litsense-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(opts.pretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  });
}

export type { Logger };
