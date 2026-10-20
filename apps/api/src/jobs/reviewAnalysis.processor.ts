import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import type { Logger } from '../lib/logger.js';
import type { ModelService } from '../modelService/index.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';

export interface ReviewAnalysisJob {
  reviewId: string;
  /** review.updatedAt in ms when the job was queued; a newer edit makes this job stale. */
  revision: number;
}

export type ReviewAnalysisOutcome = 'done' | 'stale';

/** Runs `analyze_user_review` for one review and stores the result as the reader's ReviewAnalysis. */
export function createReviewAnalysisProcessor(model: ModelService, logger: Logger) {
  return {
    async process(job: ReviewAnalysisJob): Promise<ReviewAnalysisOutcome> {
      const review = await profileRepository.findReviewById(job.reviewId);
      if (!review || review.updatedAt.getTime() !== job.revision) return 'stale';
      const result = await model.analyzeUserReview(
        { requestId: `job-${randomUUID()}` },
        { text: review.text },
      );
      const stored = await profileRepository.completeAnalysis(
        new Types.ObjectId(job.reviewId),
        job.revision,
        {
          aspects: result.aspects,
          spoilerSentences: result.spoiler_sentences,
        },
      );
      if (!stored) return 'stale';
      await userRepository.bumpProfileVersion(review.userId);
      logger.info({ reviewId: job.reviewId, aspects: Object.keys(result.aspects).length }, 'review analysed');
      return 'done';
    },

    async fail(job: ReviewAnalysisJob, err: Error, attempts: number): Promise<void> {
      await profileRepository.failAnalysis(
        new Types.ObjectId(job.reviewId),
        job.revision,
        err.message,
        attempts,
      );
      logger.error({ reviewId: job.reviewId, err: err.message, attempts }, 'review analysis failed');
    },
  };
}

export type ReviewAnalysisProcessor = ReturnType<typeof createReviewAnalysisProcessor>;
