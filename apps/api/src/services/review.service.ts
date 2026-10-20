import { ASPECT_LABELS, type Page, type ReviewDto, type TasteSummary } from '@litsense/shared';
import { decodeCursor, paginate } from '../lib/cursor.js';
import { errors } from '../lib/errors.js';
import type { JobQueue } from '../jobs/jobQueue.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type { BookCatalog } from './bookCatalog.js';
import type { LibraryService } from './library.service.js';

type ReviewRow = NonNullable<Awaited<ReturnType<typeof profileRepository.findReview>>>;
type AnalysisRow = Awaited<ReturnType<typeof profileRepository.analysesForBooks>>[number];

function toDto(review: ReviewRow, analysis: AnalysisRow | undefined): ReviewDto {
  const current = analysis && analysis.revision === review.updatedAt.getTime();
  return {
    id: String(review._id),
    bookId: review.bookId,
    stars: review.stars ?? null,
    text: review.text,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    analysis: {
      status: current ? analysis.status : 'pending',
      aspects:
        current && analysis.status === 'done' ? ((analysis.aspects ?? {}) as Record<string, number>) : {},
      spoilerSentences: current ? (analysis.spoilerSentences ?? 0) : 0,
    },
  };
}

export class ReviewService {
  constructor(
    private readonly catalog: BookCatalog,
    private readonly library: LibraryService,
    private readonly jobs: JobQueue,
  ) {}

  /** Saves the review now; aspect analysis runs as a background job (BullMQ, or inline without Redis). */
  async upsert(
    userId: string,
    input: { bookId: number; text: string; stars?: number; markRead?: boolean },
  ): Promise<ReviewDto> {
    await this.catalog.requireBook(input.bookId);
    const existing = await profileRepository.findReview(userId, input.bookId);
    const stars = input.stars ?? existing?.stars ?? null;
    const review = await profileRepository.upsertReview(userId, input.bookId, input.text, stars);
    if (input.stars !== undefined) await this.library.rate(userId, input.bookId, input.stars);
    else if (input.markRead) await this.library.setStatus(userId, input.bookId, 'read');

    const revision = review.updatedAt.getTime();
    await profileRepository.markAnalysisPending(userId, input.bookId, review._id, revision);
    await this.jobs.enqueueReviewAnalysis({ reviewId: String(review._id), revision });
    return toDto(review, undefined);
  }

  async get(userId: string, bookId: number): Promise<ReviewDto> {
    const review = await profileRepository.findReview(userId, bookId);
    if (!review) throw errors.notFound('Review');
    const [analysis] = await profileRepository.analysesForBooks(userId, [bookId]);
    return toDto(review, analysis);
  }

  async page(userId: string, rawCursor: string | undefined, limit: number): Promise<Page<ReviewDto>> {
    const rows = await profileRepository.reviewsPage(userId, decodeCursor(rawCursor), limit);
    const { rows: page, nextCursor } = paginate(rows, limit, (r) => r.updatedAt);
    const analyses = await profileRepository.analysesForBooks(
      userId,
      page.map((r) => r.bookId),
    );
    const byBook = new Map(analyses.map((a) => [a.bookId, a]));
    return { items: page.map((r) => toDto(r, byBook.get(r.bookId))), nextCursor };
  }

  async remove(userId: string, bookId: number): Promise<void> {
    if (!(await profileRepository.deleteReview(userId, bookId))) throw errors.notFound('Review');
    await userRepository.bumpProfileVersion(userId);
  }

  /** What LitSense heard across the reader's reviews: mean polarity per aspect. */
  async taste(userId: string): Promise<TasteSummary> {
    const analyses = await profileRepository.analysesForUser(userId, 'done');
    const sums = new Map<string, { total: number; n: number }>();
    for (const a of analyses) {
      for (const [aspect, polarity] of Object.entries((a.aspects ?? {}) as Record<string, number>)) {
        const s = sums.get(aspect) ?? { total: 0, n: 0 };
        sums.set(aspect, { total: s.total + polarity, n: s.n + 1 });
      }
    }
    return {
      reviews: analyses.length,
      aspects: [...sums]
        .map(([aspect, s]) => ({
          aspect,
          label: aspect in ASPECT_LABELS ? ASPECT_LABELS[aspect as keyof typeof ASPECT_LABELS] : aspect,
          polarity: Math.round((s.total / s.n) * 1000) / 1000,
          n: s.n,
        }))
        .sort((a, b) => Math.abs(b.polarity) * b.n - Math.abs(a.polarity) * a.n),
    };
  }
}
