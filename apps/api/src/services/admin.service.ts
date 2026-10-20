import type { AdminOverview, MetricsReport } from '@litsense/shared';
import type { CallContext, CircuitBreaker, ModelService } from '../modelService/index.js';
import { bookRepository } from '../repositories/book.repository.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';

export class AdminService {
  constructor(
    private readonly model: ModelService,
    private readonly breaker: CircuitBreaker,
  ) {}

  async overview(ctx: CallContext): Promise<AdminOverview> {
    const [users, books, ratings, reviews, chatSessions, modelHealth] = await Promise.all([
      userRepository.count(),
      bookRepository.count(),
      libraryRepository.countRatings(),
      profileRepository.countReviews(),
      chatRepository.count(),
      this.model.health(ctx).catch(() => null),
    ]);
    return {
      users,
      books,
      ratings,
      reviews,
      chatSessions,
      modelMode: this.model.mode,
      modelHealth: modelHealth as Record<string, unknown> | null,
      breaker: this.breaker.snapshot(),
    };
  }

  metrics(ctx: CallContext): Promise<MetricsReport> {
    return this.model.metricsReport(ctx);
  }
}
