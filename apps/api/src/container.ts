import type { Redis } from 'ioredis';
import type { AppConfig } from './config/env.js';
import { BullJobQueue, InlineJobQueue, type JobQueue } from './jobs/jobQueue.js';
import {
  createReviewAnalysisProcessor,
  type ReviewAnalysisProcessor,
} from './jobs/reviewAnalysis.processor.js';
import { Cached, MemoryCache, RedisCache } from './lib/cache.js';
import type { Logger } from './lib/logger.js';
import { createModelService, type CircuitBreaker, type ModelService } from './modelService/index.js';
import { AccountService } from './services/account.service.js';
import { AdminService } from './services/admin.service.js';
import { AuthService } from './services/auth.service.js';
import { BookCatalog } from './services/bookCatalog.js';
import { BookService } from './services/book.service.js';
import { CatalogSeedService } from './services/catalogSeed.service.js';
import { ChatService } from './services/chat.service.js';
import { LibraryService } from './services/library.service.js';
import { OnboardingService } from './services/onboarding.service.js';
import { RecommendationService } from './services/recommendation.service.js';
import { ReviewService } from './services/review.service.js';
import { TokenService } from './services/token.service.js';
import { UserStateBuilder } from './services/userState.service.js';

export interface Container {
  config: AppConfig;
  logger: Logger;
  redis: Redis | null;
  cache: Cached;
  model: ModelService;
  breaker: CircuitBreaker;
  jobs: JobQueue;
  reviewProcessor: ReviewAnalysisProcessor;
  tokens: TokenService;
  catalog: BookCatalog;
  states: UserStateBuilder;
  auth: AuthService;
  account: AccountService;
  library: LibraryService;
  onboarding: OnboardingService;
  recommendations: RecommendationService;
  books: BookService;
  chat: ChatService;
  reviews: ReviewService;
  admin: AdminService;
  seed: CatalogSeedService;
}

export interface ContainerOverrides {
  model?: ModelService;
  breaker?: CircuitBreaker;
  jobs?: (processor: ReviewAnalysisProcessor) => JobQueue;
}

export function createContainer(
  config: AppConfig,
  logger: Logger,
  redis: Redis | null,
  overrides: ContainerOverrides = {},
): Container {
  const handle = createModelService(config, logger);
  const model = overrides.model ?? handle.service;
  const breaker = overrides.breaker ?? handle.breaker;
  const cache = new Cached(redis ? new RedisCache(redis, logger) : new MemoryCache());
  const reviewProcessor = createReviewAnalysisProcessor(model, logger.child({ component: 'jobs' }));
  const jobs =
    overrides.jobs?.(reviewProcessor) ??
    (redis
      ? new BullJobQueue({ url: config.REDIS_URL ?? '', maxRetriesPerRequest: null })
      : new InlineJobQueue(reviewProcessor, logger));

  const tokens = new TokenService(
    config.JWT_ACCESS_SECRET,
    config.ACCESS_TOKEN_TTL_S,
    config.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
  );
  const catalog = new BookCatalog(logger);
  const states = new UserStateBuilder(catalog);
  const auth = new AuthService(config, tokens, logger);
  const library = new LibraryService(catalog);

  return {
    config,
    logger,
    redis,
    cache,
    model,
    breaker,
    jobs,
    reviewProcessor,
    tokens,
    catalog,
    states,
    auth,
    account: new AccountService((h, p) => auth.verifyPassword(h, p), logger),
    library,
    onboarding: new OnboardingService(model, catalog, cache),
    recommendations: new RecommendationService(model, states, catalog, cache, config.CACHE_TTL_S),
    books: new BookService(model, catalog, states, cache, config.CACHE_TTL_S),
    chat: new ChatService(model, states, catalog),
    reviews: new ReviewService(catalog, library, jobs),
    admin: new AdminService(model, breaker),
    seed: new CatalogSeedService(model, catalog, logger),
  };
}
