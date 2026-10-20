/**
 * Public HTTP API of the LitSense backend (`/api/v1`): request bodies, query strings and response
 * shapes shared by apps/api (validation + OpenAPI) and apps/web (typed client).
 * Contract payloads (evidence, chips, insights) pass through in their snake_case form.
 */
import { z } from 'zod';
import {
  AspectBar,
  Bucket,
  Chip,
  Clarification,
  Evidence,
  ListStatus,
  Method,
  OnboardingProfile,
  Snippet,
} from './contract.js';

// ---------------------------------------------------------------- errors and paging

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'ACCOUNT_LOCKED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'MODEL_UNAVAILABLE',
  'MODEL_BAD_RESPONSE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export const PageQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuery>;

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------- books

export const CoverStyle = z.object({
  c1: z.string(),
  c2: z.string(),
  ink: z.string(),
  accent: z.string(),
  motif: z.string(),
  layout: z.string(),
  font: z.string(),
});
export type CoverStyle = z.infer<typeof CoverStyle>;

export const BookDto = z.object({
  bookId: z.number().int(),
  title: z.string(),
  author: z.string().nullable(),
  genres: z.array(z.string()),
  primaryGenre: z.string(),
  year: z.number().int().nullable(),
  pages: z.number().int().nullable(),
  description: z.string(),
  image: z.string().nullable(),
  isbn13: z.string().nullable(),
  series: z.object({ id: z.string(), name: z.string().nullable(), pos: z.number().nullable() }).nullable(),
  avgRating: z.number().nullable(),
  ratingsCount: z.number().int().nullable(),
  tagline: z.string().nullable(),
  cover: CoverStyle.nullable(),
});
export type BookDto = z.infer<typeof BookDto>;

export const BookIdParam = z.object({ bookId: z.coerce.number().int().min(0) });

export const BookListQuery = PageQuery.extend({
  genre: z.string().max(80).optional(),
});
export type BookListQuery = z.infer<typeof BookListQuery>;

export const GenresResponse = z.object({
  genres: z.array(z.object({ name: z.string(), count: z.number().int() })),
});
export type GenresResponse = z.infer<typeof GenresResponse>;

// ---------------------------------------------------------------- recommendations

export const RecItemDto = z.object({
  book: BookDto,
  rank: z.number().int(),
  score: z.number(),
  sources: z.array(z.string()),
  reason: z.string(),
  reasonMethod: Method,
  evidence: Evidence,
});
export type RecItemDto = z.infer<typeof RecItemDto>;

const csv = z
  .string()
  .max(500)
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );

export const FeedQuery = z.object({
  k: z.coerce.number().int().min(1).max(50).default(20),
  minYear: z.coerce.number().int().min(0).max(3000).optional(),
  maxYear: z.coerce.number().int().min(0).max(3000).optional(),
  minPages: z.coerce.number().int().min(0).max(10000).optional(),
  maxPages: z.coerce.number().int().min(0).max(10000).optional(),
  genres: csv.optional(),
  excludeGenres: csv.optional(),
});
export type FeedQuery = z.input<typeof FeedQuery>;

export const FeedResponse = z.object({
  items: z.array(RecItemDto),
  continueSeries: z.array(RecItemDto),
  bucket: Bucket,
  degraded: z.boolean(),
  modelVersion: z.string(),
  profileVersion: z.number().int(),
});
export type FeedResponse = z.infer<typeof FeedResponse>;

export const RailsResponse = z.object({
  topPicks: z.array(RecItemDto),
  becauseYouLiked: z.array(z.object({ anchor: BookDto, items: z.array(RecItemDto) })),
  trending: z.array(RecItemDto),
  moreByAuthors: z.array(RecItemDto),
  continueExploring: z.array(RecItemDto),
  hiddenGems: z.array(RecItemDto),
  fromReadingList: z.array(RecItemDto),
  continueSeries: z.array(RecItemDto),
  profileVersion: z.number().int(),
});
export type RailsResponse = z.infer<typeof RailsResponse>;

export const ExplanationDto = z.object({
  bookId: z.number().int(),
  text: z.string(),
  method: Method,
  evidence: Evidence,
});
export type ExplanationDto = z.infer<typeof ExplanationDto>;

export const InsightsDto = z.object({
  bookId: z.number().int(),
  aspectBars: z.array(AspectBar),
  reviewSummary: z.string().nullable(),
  snippets: z.array(Snippet),
  nReviews: z.number().int(),
});
export type InsightsDto = z.infer<typeof InsightsDto>;

export const RelatedQuery = z.object({ k: z.coerce.number().int().min(1).max(20).default(8) });

// ---------------------------------------------------------------- search

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  k: z.coerce.number().int().min(1).max(50).default(20),
  genres: csv.optional(),
});
export type SearchQuery = z.input<typeof SearchQuery>;

export const SearchResponse = z.object({
  hits: z.array(
    z.object({ book: BookDto, score: z.number(), matched: z.enum(['semantic', 'title', 'author']) }),
  ),
  entity: z
    .object({
      kind: z.enum(['title', 'author', 'none', 'ambiguous']),
      author: z.string().nullable(),
      options: z.array(z.string()),
    })
    .nullable(),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

// ---------------------------------------------------------------- auth and account

export const Email = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase().trim());
export const Password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((s) => /[a-zA-Z]/.test(s) && /\d/.test(s), 'Use letters and at least one number');

export const RegisterBody = z.object({
  email: Email,
  password: Password,
  name: z.string().trim().min(1).max(60),
});
export type RegisterBody = z.input<typeof RegisterBody>;

export const LoginBody = z.object({ email: Email, password: z.string().min(1).max(128) });
export type LoginBody = z.input<typeof LoginBody>;

export const Role = z.enum(['user', 'admin']);
export type Role = z.infer<typeof Role>;

export const OverridesDto = z.object({
  mutedGenres: z.array(z.string()),
  pinnedAspects: z.array(z.string()),
  disabledAi: z.boolean(),
});
export type OverridesDto = z.infer<typeof OverridesDto>;

export const UserDto = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: Role,
  onboarded: z.boolean(),
  overrides: OverridesDto,
  profileVersion: z.number().int(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof UserDto>;

export const AuthResponse = z.object({ user: UserDto, csrfToken: z.string() });
export type AuthResponse = z.infer<typeof AuthResponse>;

export const CsrfResponse = z.object({ csrfToken: z.string() });

export const UpdateAccountBody = z.object({ name: z.string().trim().min(1).max(60) });
export type UpdateAccountBody = z.input<typeof UpdateAccountBody>;

export const UpdateOverridesBody = z
  .object({
    mutedGenres: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    pinnedAspects: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    disabledAi: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Send at least one field');
export type UpdateOverridesBody = z.input<typeof UpdateOverridesBody>;

export const DeleteAccountBody = z.object({ password: z.string().min(1).max(128) });

// ---------------------------------------------------------------- library

export const RateBody = z.object({ stars: z.number().min(1).max(5).multipleOf(0.5) });
export type RateBody = z.input<typeof RateBody>;

export const ListBody = z.object({
  status: ListStatus,
  progress: z.number().int().min(0).max(100).optional(),
});
export type ListBody = z.input<typeof ListBody>;

export const RatingDto = z.object({ book: BookDto, stars: z.number(), ratedAt: z.string() });
export type RatingDto = z.infer<typeof RatingDto>;

export const ListEntryDto = z.object({
  book: BookDto,
  status: ListStatus,
  progress: z.number().int().nullable(),
  updatedAt: z.string(),
});
export type ListEntryDto = z.infer<typeof ListEntryDto>;

export const DismissalDto = z.object({ book: BookDto, dismissedAt: z.string() });
export type DismissalDto = z.infer<typeof DismissalDto>;

export const ListQuery = PageQuery.extend({ status: ListStatus.optional() });
export type ListQuery = z.input<typeof ListQuery>;

/** Compact view of everything the reader has done, for shelf controls on every card. */
export const LibraryIndex = z.object({
  ratings: z.record(z.string(), z.number()),
  statuses: z.record(z.string(), z.object({ status: ListStatus, progress: z.number().nullable() })),
  dismissed: z.array(z.number().int()),
  reviewed: z.array(z.number().int()),
  profileVersion: z.number().int(),
});
export type LibraryIndex = z.infer<typeof LibraryIndex>;

export const LibraryStats = z.object({
  read: z.number().int(),
  reading: z.number().int(),
  want: z.number().int(),
  dropped: z.number().int(),
  rated: z.number().int(),
  pagesRead: z.number().int(),
  avgStars: z.number().nullable(),
  topGenres: z.array(z.object({ genre: z.string(), books: z.number().int() })),
});
export type LibraryStats = z.infer<typeof LibraryStats>;

export const RecentReadDto = z.object({
  book: BookDto,
  finishedAt: z.string(),
  stars: z.number().nullable(),
  review: z.object({ text: z.string(), aspects: z.record(z.string(), z.number()) }).nullable(),
});
export type RecentReadDto = z.infer<typeof RecentReadDto>;

// ---------------------------------------------------------------- reviews

export const ReviewBody = z.object({
  bookId: z.number().int().min(0),
  stars: z.number().min(1).max(5).multipleOf(0.5).optional(),
  text: z.string().trim().min(1).max(5000),
  markRead: z.boolean().optional(),
});
export type ReviewBody = z.input<typeof ReviewBody>;

export const ReviewAnalysisStatus = z.enum(['pending', 'done', 'failed']);

export const ReviewDto = z.object({
  id: z.string(),
  bookId: z.number().int(),
  stars: z.number().nullable(),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  analysis: z.object({
    status: ReviewAnalysisStatus,
    aspects: z.record(z.string(), z.number()),
    spoilerSentences: z.number().int(),
  }),
});
export type ReviewDto = z.infer<typeof ReviewDto>;

export const TasteSummary = z.object({
  aspects: z.array(
    z.object({ aspect: z.string(), label: z.string(), polarity: z.number(), n: z.number().int() }),
  ),
  reviews: z.number().int(),
});
export type TasteSummary = z.infer<typeof TasteSummary>;

// ---------------------------------------------------------------- onboarding

export const OnboardingGridResponse = z.object({ books: z.array(BookDto) });

export const OnboardingBody = z.object({
  picks: z.array(z.number().int().min(0)).max(30).default([]),
  text: z.string().trim().max(1000).default(''),
});
export type OnboardingBody = z.input<typeof OnboardingBody>;

export const OnboardingDto = z.object({
  picks: z.array(BookDto),
  text: z.string(),
  profile: OnboardingProfile,
  displayChips: z.array(z.string()),
  method: z.enum(['llm', 'embed_only']),
  updatedAt: z.string(),
});
export type OnboardingDto = z.infer<typeof OnboardingDto>;

export const OnboardingProfilePatch = z.object({ profile: OnboardingProfile });

// ---------------------------------------------------------------- chat

export const ChatItemDto = z.object({ book: BookDto, reason: z.string(), evidence: Evidence });
export type ChatItemDto = z.infer<typeof ChatItemDto>;

export const ChatTurnDto = z.discriminatedUnion('role', [
  z.object({ id: z.string(), role: z.literal('user'), text: z.string(), at: z.string() }),
  z.object({
    id: z.string(),
    role: z.literal('assistant'),
    intro: z.string(),
    items: z.array(ChatItemDto),
    followup: z.string().nullable(),
    clarification: Clarification.nullable(),
    chips: z.array(Chip),
    intent: z.string(),
    method: Method,
    at: z.string(),
  }),
]);
export type ChatTurnDto = z.infer<typeof ChatTurnDto>;
export type AssistantTurnDto = Extract<ChatTurnDto, { role: 'assistant' }>;

export const ChatSessionDto = z.object({
  id: z.string(),
  title: z.string(),
  turns: z.array(ChatTurnDto),
  chips: z.array(Chip),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatSessionDto = z.infer<typeof ChatSessionDto>;

export const ChatSessionSummary = z.object({
  id: z.string(),
  title: z.string(),
  turnCount: z.number().int(),
  updatedAt: z.string(),
});
export type ChatSessionSummary = z.infer<typeof ChatSessionSummary>;

export const ChatMessageBody = z.object({ message: z.string().trim().min(1).max(500) });
export type ChatMessageBody = z.input<typeof ChatMessageBody>;

export const SessionIdParam = z.object({ sessionId: z.string().regex(/^[a-f0-9]{24}$/) });

export const ChipKeyParam = z.object({
  sessionId: z.string().regex(/^[a-f0-9]{24}$/),
  key: z.string().min(1).max(200),
});

// ---------------------------------------------------------------- admin and health

export const HealthResponse = z.object({ status: z.literal('ok'), uptimeS: z.number() });
export const ReadinessResponse = z.object({
  status: z.enum(['ready', 'degraded', 'not_ready']),
  checks: z.record(z.string(), z.object({ ok: z.boolean(), detail: z.string().optional() })),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponse>;

export const AdminOverview = z.object({
  users: z.number().int(),
  books: z.number().int(),
  ratings: z.number().int(),
  reviews: z.number().int(),
  chatSessions: z.number().int(),
  modelMode: z.enum(['mock', 'http']),
  modelHealth: z.record(z.string(), z.unknown()).nullable(),
  breaker: z.object({ state: z.enum(['closed', 'open', 'half_open']), failures: z.number().int() }),
});
export type AdminOverview = z.infer<typeof AdminOverview>;

export const SeedResponse = z.object({ upserted: z.number().int(), source: z.enum(['model', 'fixture']) });
