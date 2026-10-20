import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Logger } from '../lib/logger.js';
import { sleep } from '../modelService/retry.js';
import type { ReviewAnalysisJob, ReviewAnalysisProcessor } from './reviewAnalysis.processor.js';

export const REVIEW_QUEUE = 'review-analysis';
const ATTEMPTS = 3;
const BACKOFF_MS = 2000;

export interface JobQueue {
  readonly kind: 'bullmq' | 'inline';
  enqueueReviewAnalysis(job: ReviewAnalysisJob): Promise<void>;
  /** Resolves when every queued inline job has finished (tests and graceful shutdown). */
  drain(): Promise<void>;
  close(): Promise<void>;
}

/** Fallback when Redis is absent: runs jobs in this process after the response, with the same retries. */
export class InlineJobQueue implements JobQueue {
  readonly kind = 'inline' as const;
  private readonly running = new Set<Promise<void>>();

  constructor(
    private readonly processor: ReviewAnalysisProcessor,
    private readonly logger: Logger,
    private readonly backoffMs = BACKOFF_MS,
  ) {}

  async enqueueReviewAnalysis(job: ReviewAnalysisJob): Promise<void> {
    const p = this.run(job).finally(() => this.running.delete(p));
    this.running.add(p);
  }

  private async run(job: ReviewAnalysisJob): Promise<void> {
    await new Promise((r) => setImmediate(r));
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      try {
        await this.processor.process(job);
        return;
      } catch (err) {
        if (attempt === ATTEMPTS) {
          await this.processor
            .fail(job, err as Error, attempt)
            .catch((e: Error) => this.logger.error({ err: e.message }, 'could not record job failure'));
          return;
        }
        await sleep(this.backoffMs * 2 ** (attempt - 1));
      }
    }
  }

  async drain(): Promise<void> {
    while (this.running.size) await Promise.allSettled([...this.running]);
  }

  async close(): Promise<void> {
    await this.drain();
  }
}

export class BullJobQueue implements JobQueue {
  readonly kind = 'bullmq' as const;
  private readonly queue: Queue<ReviewAnalysisJob>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<ReviewAnalysisJob>(REVIEW_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_MS },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  async enqueueReviewAnalysis(job: ReviewAnalysisJob): Promise<void> {
    // jobId dedupes double submits of the same review revision.
    await this.queue.add('analyze', job, { jobId: `${job.reviewId}-${job.revision}` });
  }

  async drain(): Promise<void> {}

  async close(): Promise<void> {
    await this.queue.close();
  }
}

/** Starts the BullMQ consumer (in the api process or in `worker.ts`). */
export function startReviewWorker(
  connection: ConnectionOptions,
  processor: ReviewAnalysisProcessor,
  logger: Logger,
  concurrency = 4,
): Worker<ReviewAnalysisJob> {
  const worker = new Worker<ReviewAnalysisJob>(REVIEW_QUEUE, async (job) => processor.process(job.data), {
    connection,
    concurrency,
  });
  worker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void processor.fail(job.data, err, job.attemptsMade);
    }
  });
  worker.on('error', (err) => logger.error({ err: err.message }, 'review worker error'));
  return worker;
}
