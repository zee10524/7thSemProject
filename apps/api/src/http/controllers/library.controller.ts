import { z } from 'zod';
import {
  BookIdParam,
  DismissalDto,
  LibraryIndex,
  LibraryStats,
  ListBody,
  ListEntryDto,
  ListQuery,
  OnboardingBody,
  OnboardingDto,
  OnboardingGridResponse,
  OnboardingProfilePatch,
  PageQuery,
  RateBody,
  RatingDto,
  RecentReadDto,
  ReviewBody,
  ReviewDto,
  TasteSummary,
  pageOf,
} from '@litsense/shared';
import type { Container } from '../../container.js';
import { type AnyRoute, defineRoute } from '../route.js';

const RateResult = z.object({ stars: z.number(), ratedAt: z.string(), profileVersion: z.number().int() });
const RecentQuery = z.object({ limit: z.coerce.number().int().min(1).max(20).default(6) });

export function libraryRoutes(c: Container): AnyRoute[] {
  return [
    defineRoute({
      method: 'get',
      path: '/me/library',
      tag: 'Library',
      summary: 'Compact index of ratings, shelf statuses, dismissals and reviews',
      auth: 'user',
      response: LibraryIndex,
      handler: ({ userId }) => c.library.index(userId()),
    }),
    defineRoute({
      method: 'get',
      path: '/me/stats',
      tag: 'Library',
      summary: 'Reading stats for My Books',
      auth: 'user',
      response: LibraryStats,
      handler: ({ userId }) => c.library.stats(userId()),
    }),
    defineRoute({
      method: 'get',
      path: '/me/ratings',
      tag: 'Library',
      summary: 'Ratings, newest first (cursor paginated)',
      auth: 'user',
      query: PageQuery,
      response: pageOf(RatingDto),
      handler: ({ userId, query }) => c.library.ratings(userId(), query.cursor, query.limit),
    }),
    defineRoute({
      method: 'put',
      path: '/me/ratings/:bookId',
      tag: 'Library',
      summary: 'Rate a book (1 to 5, half stars). Idempotent; honours Idempotency-Key.',
      auth: 'user',
      params: BookIdParam,
      body: RateBody,
      response: RateResult,
      idempotent: true,
      handler: ({ userId, params, body }) => c.library.rate(userId(), params.bookId, body.stars),
    }),
    defineRoute({
      method: 'delete',
      path: '/me/ratings/:bookId',
      tag: 'Library',
      summary: 'Remove a rating',
      auth: 'user',
      params: BookIdParam,
      idempotent: true,
      handler: async ({ userId, params }) => {
        await c.library.unrate(userId(), params.bookId);
      },
    }),
    defineRoute({
      method: 'get',
      path: '/me/reading-list',
      tag: 'Library',
      summary: 'Reading list, optionally by status (cursor paginated)',
      auth: 'user',
      query: ListQuery,
      response: pageOf(ListEntryDto),
      handler: ({ userId, query }) =>
        c.library.readingList(userId(), query.status, query.cursor, query.limit),
    }),
    defineRoute({
      method: 'put',
      path: '/me/reading-list/:bookId',
      tag: 'Library',
      summary: 'Set a shelf status (want_to_read, currently_reading, read, dropped)',
      auth: 'user',
      params: BookIdParam,
      body: ListBody,
      response: ListEntryDto,
      handler: ({ userId, params, body }) =>
        c.library.setStatus(userId(), params.bookId, body.status, body.progress),
    }),
    defineRoute({
      method: 'delete',
      path: '/me/reading-list/:bookId',
      tag: 'Library',
      summary: 'Take a book off the shelves',
      auth: 'user',
      params: BookIdParam,
      handler: async ({ userId, params }) => {
        await c.library.removeFromList(userId(), params.bookId);
      },
    }),
    defineRoute({
      method: 'get',
      path: '/me/dismissed',
      tag: 'Library',
      summary: 'Books the reader said "not for me" to (cursor paginated)',
      auth: 'user',
      query: PageQuery,
      response: pageOf(DismissalDto),
      handler: ({ userId, query }) => c.library.dismissed(userId(), query.cursor, query.limit),
    }),
    defineRoute({
      method: 'put',
      path: '/me/dismissed/:bookId',
      tag: 'Library',
      summary: 'Dismiss a recommendation',
      auth: 'user',
      params: BookIdParam,
      handler: async ({ userId, params }) => {
        await c.library.dismiss(userId(), params.bookId);
      },
    }),
    defineRoute({
      method: 'delete',
      path: '/me/dismissed/:bookId',
      tag: 'Library',
      summary: 'Undo a dismissal',
      auth: 'user',
      params: BookIdParam,
      handler: async ({ userId, params }) => {
        await c.library.undismiss(userId(), params.bookId);
      },
    }),
    defineRoute({
      method: 'post',
      path: '/me/views/:bookId',
      tag: 'Library',
      summary: 'Record a book page view (feeds "continue exploring")',
      auth: 'user',
      params: BookIdParam,
      handler: async ({ userId, params }) => {
        await c.library.recordView(userId(), params.bookId);
      },
    }),
    defineRoute({
      method: 'get',
      path: '/me/recent-reads',
      tag: 'Library',
      summary: 'Recently finished books with the reader rating and review',
      auth: 'user',
      query: RecentQuery,
      response: z.array(RecentReadDto),
      handler: ({ userId, query }) => c.library.recentReads(userId(), query.limit),
    }),

    // ---------------------------------------------------------------- reviews
    defineRoute({
      method: 'get',
      path: '/me/reviews',
      tag: 'Reviews',
      summary: 'The reader reviews with their aspect analysis (cursor paginated)',
      auth: 'user',
      query: PageQuery,
      response: pageOf(ReviewDto),
      handler: ({ userId, query }) => c.reviews.page(userId(), query.cursor, query.limit),
    }),
    defineRoute({
      method: 'put',
      path: '/me/reviews',
      tag: 'Reviews',
      summary: 'Write or replace a review; aspect analysis runs as a background job',
      auth: 'user',
      body: ReviewBody,
      response: ReviewDto,
      idempotent: true,
      handler: ({ userId, body }) => c.reviews.upsert(userId(), body),
    }),
    defineRoute({
      method: 'get',
      path: '/me/reviews/:bookId',
      tag: 'Reviews',
      summary: 'The reader review of one book',
      auth: 'user',
      params: BookIdParam,
      response: ReviewDto,
      handler: ({ userId, params }) => c.reviews.get(userId(), params.bookId),
    }),
    defineRoute({
      method: 'delete',
      path: '/me/reviews/:bookId',
      tag: 'Reviews',
      summary: 'Delete a review and its analysis',
      auth: 'user',
      params: BookIdParam,
      handler: async ({ userId, params }) => {
        await c.reviews.remove(userId(), params.bookId);
      },
    }),
    defineRoute({
      method: 'get',
      path: '/me/taste',
      tag: 'Reviews',
      summary: 'What LitSense heard across the reader reviews (mean polarity per aspect)',
      auth: 'user',
      response: TasteSummary,
      handler: ({ userId }) => c.reviews.taste(userId()),
    }),

    // ---------------------------------------------------------------- onboarding
    defineRoute({
      method: 'get',
      path: '/onboarding/grid',
      tag: 'Onboarding',
      summary: 'Popular, genre-diverse books for the cover picker',
      auth: 'user',
      response: OnboardingGridResponse,
      handler: async ({ call }) => ({ books: await c.onboarding.grid(call) }),
    }),
    defineRoute({
      method: 'get',
      path: '/me/onboarding',
      tag: 'Onboarding',
      summary: 'The stored onboarding profile, or null',
      auth: 'user',
      response: OnboardingDto.nullable(),
      handler: ({ userId }) => c.onboarding.get(userId()),
    }),
    defineRoute({
      method: 'put',
      path: '/me/onboarding',
      tag: 'Onboarding',
      summary: 'Save cover picks and a taste sentence (parsed by parse_onboarding)',
      auth: 'user',
      body: OnboardingBody,
      response: OnboardingDto,
      handler: ({ userId, body, call }) => c.onboarding.save(call, userId(), body),
    }),
    defineRoute({
      method: 'patch',
      path: '/me/onboarding/profile',
      tag: 'Onboarding',
      summary: 'Correct what LitSense understood (remove a chip)',
      auth: 'user',
      body: OnboardingProfilePatch,
      response: OnboardingDto,
      handler: ({ userId, body }) => c.onboarding.updateProfile(userId(), body.profile),
    }),
    defineRoute({
      method: 'post',
      path: '/me/onboarding/skip',
      tag: 'Onboarding',
      summary: 'Skip onboarding for now',
      auth: 'user',
      handler: async ({ userId }) => {
        await c.onboarding.skip(userId());
      },
    }),
  ];
}
