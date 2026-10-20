import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { errors } from '../../lib/errors.js';
import { sha256, stableStringify } from '../../lib/hash.js';
import type { Logger } from '../../lib/logger.js';
import { authRepository } from '../../repositories/auth.repository.js';

const KEY = /^[A-Za-z0-9_:.-]{8,200}$/;

/**
 * `Idempotency-Key` support (IETF draft-ietf-httpapi-idempotency-key-header): the first request with a
 * key runs and its response is stored for 24 h; a retry with the same key and body replays it; the
 * same key with a different body is a 409.
 */
export function idempotency(logger: Logger): RequestHandler {
  return async (req, res, next) => {
    const key = req.get('idempotency-key');
    if (!key || !req.user) return next();
    if (!KEY.test(key))
      return next(errors.badRequest('Idempotency-Key must be 8 to 200 URL-safe characters.'));

    const userId = new Types.ObjectId(req.user.id);
    const requestHash = sha256(`${req.method} ${req.originalUrl} ${stableStringify(req.body ?? null)}`);
    const claimed = await authRepository.claimIdempotencyKey({
      userId,
      key,
      method: req.method,
      path: req.originalUrl,
      requestHash,
    });

    if (!claimed) {
      const record = await authRepository.findIdempotencyKey(userId, key);
      if (!record || record.requestHash !== requestHash) {
        return next(errors.conflict('This Idempotency-Key was already used for a different request.'));
      }
      if (record.state !== 'done')
        return next(errors.conflict('A request with this Idempotency-Key is still running.'));
      res.setHeader('Idempotent-Replayed', 'true');
      if (record.body === null) return void res.status(record.status ?? 204).end();
      return void res.status(record.status ?? 200).json(record.body);
    }

    let captured: unknown = null;
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      captured = body;
      return json(body);
    };
    res.once('finish', () => {
      const done =
        res.statusCode < 500
          ? authRepository.completeIdempotencyKey(userId, key, res.statusCode, captured)
          : authRepository.releaseIdempotencyKey(userId, key);
      done.catch((err: Error) => logger.warn({ err: err.message }, 'idempotency bookkeeping failed'));
    });
    next();
  };
}
