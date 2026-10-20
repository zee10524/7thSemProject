/**
 * Zod mirror of `litsense_core/schemas.py` (core API 0.1.0, docs/API_CONTRACT.md sections 2 to 5).
 * Field names stay snake_case so payloads pass through unchanged. The Python file is the source of
 * truth: when it changes, change this file and bump CORE_API_VERSION.
 */
import { z } from 'zod';

export const CORE_API_VERSION = '0.1.0';

/** Epoch milliseconds; the bounds reject epoch seconds (a classic unit bug). */
export const TimestampMs = z.number().int().min(100_000_000_000).max(9_999_999_999_999);
export const BookId = z.number().int().min(0);
export const Stars = z.number().min(1).max(5);

export const LIST_STATUSES = ['want_to_read', 'currently_reading', 'read', 'dropped'] as const;
export const ListStatus = z.enum(LIST_STATUSES);
export type ListStatus = z.infer<typeof ListStatus>;

export const BUCKETS = ['cold', 'warming', 'blending', 'warm'] as const;
export const Bucket = z.enum(BUCKETS);
export type Bucket = z.infer<typeof Bucket>;

export const Method = z.enum(['template', 'llm']);
export type Method = z.infer<typeof Method>;

/** Known chat intents. Parsed as a plain string so a new intent never breaks the app. */
export const INTENTS = [
  'recommend_general',
  'similar_to',
  'similar_to_with_modifier',
  'more_by_author',
  'refine_previous',
  'explain_recommendation',
  'filter_by_attribute',
  'mixed_opinion',
  'out_of_scope',
] as const;
export type KnownIntent = (typeof INTENTS)[number];

/** Aspect vector order (index 0 to 11) and the label the UI shows. */
export const ASPECT_LABELS = {
  plot: 'plot',
  writing_style: 'prose',
  characters: 'characters',
  world_building: 'world-building',
  pacing: 'pacing',
  editing_quality: 'editing',
  dialogue: 'dialogue',
  humor: 'humor',
  emotional_impact: 'emotional punch',
  ending: 'ending',
  complexity: 'depth',
  tone_dark: 'tone',
} as const;
export type AspectName = keyof typeof ASPECT_LABELS;
export const ASPECTS = Object.keys(ASPECT_LABELS) as AspectName[];
export const AspectNameSchema = z.enum(ASPECTS as [AspectName, ...AspectName[]]);

export const DESCRIPTORS = ['darkness', 'pace', 'complexity_level'] as const;

export const RatingEvent = z.object({ book_id: BookId, stars: Stars, ts: TimestampMs });
export type RatingEvent = z.infer<typeof RatingEvent>;

export const ListEvent = z.object({ book_id: BookId, status: ListStatus, ts: TimestampMs });
export type ListEvent = z.infer<typeof ListEvent>;

export const Overrides = z.object({
  muted_genres: z.array(z.string()).default([]),
  pinned_aspects: z.array(z.string()).default([]),
  disabled_ai: z.boolean().default(false),
});
export type Overrides = z.infer<typeof Overrides>;

export const OnboardingProfile = z.object({
  liked_genres: z.array(z.string()).default([]),
  disliked_genres: z.array(z.string()).default([]),
  positive_aspects: z.array(z.string()).default([]),
  negative_aspects: z.array(z.string()).default([]),
  descriptors: z.record(z.string(), z.number()).default({}),
  themes: z.array(z.string()).default([]),
  named_titles: z.array(z.string()).default([]),
  named_authors: z.array(z.string()).default([]),
});
export type OnboardingProfile = z.infer<typeof OnboardingProfile>;

export const ReviewAnalysis = z.object({
  book_id: BookId.nullable().default(null),
  ts: TimestampMs.nullable().default(null),
  aspects: z.record(z.string(), z.number()).default({}),
  spoiler_sentences: z.number().int().default(0),
});
export type ReviewAnalysis = z.infer<typeof ReviewAnalysis>;

export const UserState = z.object({
  user_id: z.number().int().nullable().default(null),
  corpus_user_id: z.string().nullable().default(null),
  ratings: z.array(RatingEvent).default([]),
  reading_list: z.array(ListEvent).default([]),
  dismissed: z.array(BookId).default([]),
  viewed: z.array(BookId).max(50).default([]),
  onboarding: OnboardingProfile.nullable().default(null),
  onboarding_picks: z.array(BookId).default([]),
  onboarding_text: z.string().nullable().default(null),
  review_analyses: z.array(ReviewAnalysis).default([]),
  overrides: Overrides.default({ muted_genres: [], pinned_aspects: [], disabled_ai: false }),
  profile_version: z.number().int().min(0).default(0),
});
export type UserState = z.infer<typeof UserState>;

export const Filters = z.object({
  min_year: z.number().int().nullable().default(null),
  max_year: z.number().int().nullable().default(null),
  min_pages: z.number().int().nullable().default(null),
  max_pages: z.number().int().nullable().default(null),
  genres_include: z.array(z.string()).default([]),
  genres_exclude: z.array(z.string()).default([]),
});
export type Filters = z.infer<typeof Filters>;
export type FiltersInput = z.input<typeof Filters>;

export const AspectStrength = z.object({
  aspect: z.string(),
  label: z.string(),
  strength: z.number(),
  n: z.number().int(),
});
export type AspectStrength = z.infer<typeof AspectStrength>;

export const LikedItem = z.object({ book_id: BookId, title: z.string(), stars: z.number() });
export type LikedItem = z.infer<typeof LikedItem>;

export const Snippet = z.object({
  text: z.string(),
  review_ref: z.number().int(),
  helpful_votes: z.number().int(),
  aspect: z.string(),
});
export type Snippet = z.infer<typeof Snippet>;

/** Facts behind a recommendation. The four dicts hold plain JSON; keys documented in schemas.py. */
export const Evidence = z.object({
  book: z.record(z.string(), z.unknown()),
  user_evidence: z.record(z.string(), z.unknown()),
  item_evidence: z.record(z.string(), z.unknown()),
  signals: z.record(z.string(), z.unknown()),
});
export type Evidence = z.infer<typeof Evidence>;

export const RecItem = z.object({
  book_id: BookId,
  rank: z.number().int(),
  score: z.number(),
  sources: z.array(z.string()),
  reason: z.string(),
  reason_method: Method.default('template'),
  evidence: Evidence,
});
export type RecItem = z.infer<typeof RecItem>;

export const RecResponse = z.object({
  items: z.array(RecItem),
  continue_series: z.array(RecItem).default([]),
  model_version: z.string(),
  profile_version: z.number().int(),
  bucket: Bucket,
  degraded: z.boolean().default(false),
  latency_ms: z.number(),
});
export type RecResponse = z.infer<typeof RecResponse>;

export const BecauseYouLiked = z.object({ anchor_book_id: BookId, items: z.array(RecItem) });
export type BecauseYouLiked = z.infer<typeof BecauseYouLiked>;

export const HomeRails = z.object({
  top_picks: z.array(RecItem),
  because_you_liked: z.array(BecauseYouLiked),
  trending: z.array(RecItem),
  more_by_authors: z.array(RecItem).default([]),
  continue_exploring: z.array(RecItem).default([]),
  hidden_gems: z.array(RecItem).default([]),
  from_reading_list: z.array(RecItem).default([]),
  continue_series: z.array(RecItem).default([]),
});
export type HomeRails = z.infer<typeof HomeRails>;

export const SearchHit = z.object({
  book_id: BookId,
  score: z.number(),
  matched: z.enum(['semantic', 'title', 'author']),
});
export type SearchHit = z.infer<typeof SearchHit>;

export const EntityMatch = z.object({
  kind: z.enum(['title', 'author', 'none', 'ambiguous']),
  book_ids: z.array(BookId).default([]),
  author: z.string().nullable().default(null),
  options: z.array(z.string()).default([]),
});
export type EntityMatch = z.infer<typeof EntityMatch>;

export const OnboardingResult = z.object({
  profile: OnboardingProfile,
  resolved_picks: z.array(BookId),
  display_chips: z.array(z.string()),
  method: z.enum(['llm', 'embed_only']),
});
export type OnboardingResult = z.infer<typeof OnboardingResult>;

export const Explanation = z.object({
  book_id: BookId,
  text: z.string(),
  method: Method,
  evidence: Evidence,
  rejections: z.array(z.string()).default([]),
});
export type Explanation = z.infer<typeof Explanation>;

export const ChatMessage = z.object({ role: z.enum(['user', 'assistant']), text: z.string() });
export type ChatMessage = z.infer<typeof ChatMessage>;

/** Loose on purpose: the backend must persist the session exactly as the core returned it. */
export const SessionState = z.looseObject({
  session_id: z.string(),
  turn: z.number().int().default(0),
  aspect_deltas: z.record(z.string(), z.number()).default({}),
  descriptor_deltas: z.record(z.string(), z.number()).default({}),
  filters: Filters.default({
    min_year: null,
    max_year: null,
    min_pages: null,
    max_pages: null,
    genres_include: [],
    genres_exclude: [],
  }),
  excluded_ids: z.array(BookId).default([]),
  anchor_ids: z.array(BookId).default([]),
  anchor_authors: z.array(z.string()).default([]),
  last_shown: z.array(BookId).default([]),
  last_request: z.string().nullable().default(null),
  history: z.array(ChatMessage).default([]),
});
export type SessionState = z.infer<typeof SessionState>;

export const ChatItem = z.object({ book_id: BookId, reason: z.string(), evidence: Evidence });
export type ChatItem = z.infer<typeof ChatItem>;

export const Chip = z.object({ key: z.string(), label: z.string() });
export type Chip = z.infer<typeof Chip>;

export const ClarificationOption = z.object({ label: z.string(), value: z.union([z.string(), z.number()]) });
export type ClarificationOption = z.infer<typeof ClarificationOption>;

export const Clarification = z.object({ question: z.string(), options: z.array(ClarificationOption) });
export type Clarification = z.infer<typeof Clarification>;

export const ChatReply = z.object({
  intro: z.string(),
  items: z.array(ChatItem).default([]),
  followup: z.string().nullable().default(null),
  chips: z.array(Chip).default([]),
  clarification: Clarification.nullable().default(null),
  session: SessionState,
  method: Method,
  intent: z.string(),
});
export type ChatReply = z.infer<typeof ChatReply>;

export const AspectBar = z.object({
  aspect: z.string(),
  label: z.string(),
  pos_rate: z.number(),
  neg_rate: z.number(),
  mention_rate: z.number(),
});
export type AspectBar = z.infer<typeof AspectBar>;

export const BookInsights = z.object({
  book_id: BookId,
  aspect_bars: z.array(AspectBar),
  review_summary: z.string().nullable(),
  snippets: z.array(Snippet),
  n_reviews: z.number().int(),
});
export type BookInsights = z.infer<typeof BookInsights>;

/** Proposed `catalog()` row (contract section 7): what the backend seeds its books from. */
export const CatalogBook = z.object({
  book_id: BookId,
  canonical_id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  genres: z.array(z.string()),
  primary_genre: z.string(),
  year: z.number().int().nullable(),
  pages: z.number().int().nullable(),
  description: z.string(),
  image: z.string().nullable(),
  isbn13: z.string().nullable(),
  series_id: z.string().nullable().default(null),
  series_name: z.string().nullable().default(null),
  series_pos: z.number().nullable().default(null),
});
export type CatalogBook = z.infer<typeof CatalogBook>;

/**
 * One page of `GET /v1/catalog`. The model service pages by offset (`offset`, `limit`, `total`,
 * `bundle_version`); clients normalise that into `next_cursor` (the next offset, or null at the end).
 */
export const CatalogPage = z.object({
  items: z.array(CatalogBook),
  next_cursor: z.union([z.string(), z.number()]).nullable().default(null),
  total: z.number().int().optional(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
  bundle_version: z.string().optional(),
});
export type CatalogPage = z.infer<typeof CatalogPage>;

export const ModelHealth = z.looseObject({
  status: z.string().optional(),
  mock: z.boolean().optional(),
  api_version: z.string().optional(),
  bundle_version: z.string().nullable().optional(),
  ranker: z.boolean().optional(),
  llm: z.boolean().optional(),
});
export type ModelHealth = z.infer<typeof ModelHealth>;

export const MetricsReport = z.record(z.string(), z.unknown());
export type MetricsReport = z.infer<typeof MetricsReport>;

/** Keys of a chat chip, as listed in contract section 4. */
export type ChipKey =
  | { kind: 'anchor_book'; bookId: number }
  | { kind: 'anchor_author' }
  | { kind: 'descriptor'; name: string }
  | { kind: 'aspect'; name: string }
  | { kind: 'filter'; field: 'min_year' | 'max_year' | 'min_pages' | 'max_pages' }
  | { kind: 'filter_genre'; field: 'genres_include' | 'genres_exclude'; genre: string };

const FILTER_FIELDS = ['min_year', 'max_year', 'min_pages', 'max_pages'] as const;

export function parseChipKey(key: string): ChipKey | null {
  const parts = key.split(':');
  const [head, a, ...rest] = parts;
  if (head === 'anchor' && a === 'book' && rest.length === 1) {
    const id = Number(rest[0]);
    return Number.isInteger(id) && id >= 0 ? { kind: 'anchor_book', bookId: id } : null;
  }
  if (head === 'anchor' && a === 'author' && rest.length === 0) return { kind: 'anchor_author' };
  if (head === 'descriptor' && a && rest.length === 0) return { kind: 'descriptor', name: a };
  if (head === 'aspect' && a && rest.length === 0) return { kind: 'aspect', name: a };
  if (head === 'filter' && a) {
    if ((a === 'genres_include' || a === 'genres_exclude') && rest.length > 0) {
      return { kind: 'filter_genre', field: a, genre: rest.join(':') };
    }
    if ((FILTER_FIELDS as readonly string[]).includes(a) && rest.length === 0) {
      return { kind: 'filter', field: a as (typeof FILTER_FIELDS)[number] };
    }
  }
  return null;
}

/**
 * Removes the modifier named by a chip key from a session (contract section 4, step 4).
 * Returns a new session; the caller then runs `chat_turn(state, session, "")`.
 */
export function removeChipFromSession(session: SessionState, key: string): SessionState {
  const chip = parseChipKey(key);
  if (!chip) throw new Error(`Unknown chip key: ${key}`);
  const next = JSON.parse(JSON.stringify(session)) as SessionState;
  switch (chip.kind) {
    case 'anchor_book':
      next.anchor_ids = next.anchor_ids.filter((id) => id !== chip.bookId);
      break;
    case 'anchor_author':
      next.anchor_authors = [];
      break;
    case 'descriptor':
      delete next.descriptor_deltas[chip.name];
      break;
    case 'aspect':
      delete next.aspect_deltas[chip.name];
      break;
    case 'filter':
      next.filters[chip.field] = null;
      break;
    case 'filter_genre':
      next.filters[chip.field] = next.filters[chip.field].filter((g) => g !== chip.genre);
      break;
  }
  return next;
}
