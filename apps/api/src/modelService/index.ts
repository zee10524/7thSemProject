import type { AppConfig } from '../config/env.js';
import type { Logger } from '../lib/logger.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { HttpModelService } from './http.js';
import { MockModelService } from './mock/mockModelService.js';
import type { ModelService } from './types.js';

export * from './types.js';
export { CircuitBreaker } from './circuitBreaker.js';
export { HttpModelService } from './http.js';
export { MockModelService } from './mock/mockModelService.js';

export interface ModelServiceHandle {
  service: ModelService;
  breaker: CircuitBreaker;
}

export function createModelService(config: AppConfig, logger: Logger): ModelServiceHandle {
  const breaker = new CircuitBreaker({
    failureThreshold: config.BREAKER_FAILURE_THRESHOLD,
    cooldownMs: config.BREAKER_COOLDOWN_MS,
  });
  if (config.MODEL_SERVICE_MODE === 'mock') {
    return { service: new MockModelService(), breaker };
  }
  const service = new HttpModelService({
    baseUrl: config.MODEL_SERVICE_URL ?? '',
    serviceKey: config.MODEL_SERVICE_KEY ?? '',
    timeoutMs: config.MODEL_SERVICE_TIMEOUT_MS,
    slowTimeoutMs: config.MODEL_SERVICE_SLOW_TIMEOUT_MS,
    retries: config.MODEL_SERVICE_RETRIES,
    breaker,
    logger: logger.child({ component: 'model-service' }),
  });
  return { service, breaker };
}
