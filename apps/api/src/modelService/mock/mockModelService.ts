/**
 * In-process stand-in for the Python model service, ported from `litsense_core/mock.py` and run over
 * the prototype's catalogue. Same signatures and contract shapes; deterministic; never calls an LLM
 * (every method reports `template` / `embed_only`). Lets the app and its tests run without Python.
 */
import {
  ASPECT_LABELS,
  ASPECTS,
  type AspectName,
  type AspectStrength,
  type BookInsights,
  type Bucket,
  type CatalogPage,
  type ChatReply,
  type Chip,
  type EntityMatch,
  type Evidence,
  type Explanation,
  Filters,
  type FiltersInput,
  type HomeRails,
  type MetricsReport,
  type ModelHealth,
  type OnboardingProfile,
  type OnboardingResult,
  type RecItem,
  type RecResponse,
  type ReviewAnalysis,
  type SearchHit,
  SessionState,
  type Snippet,
  type UserState,
} from '@litsense/shared';
import { randomUUID } from 'node:crypto';
import { type CallContext, type ModelService, ModelServiceError } from '../types.js';
import {
  BOOKS,
  BY_AUTHOR,
  BY_TITLE,
  GENRES,
  type MockBook,
  N_BOOKS,
  catalogRows,
  norm,
  similarity,
} from './catalog.js';

export const MOCK_MODEL_VERSION = 'mock-0.1';
const CHAT_K = 5;
const BUCKET_LOWER: [Bucket, number][] = [
  ['cold', 0],
  ['warming', 1],
  ['blending', 5],
  ['warm', 20],
];

const STOPWORDS = new Set(
  'a an and about book books for i in like me novel novels of on or some something the to with want read'.split(
    ' ',
  ),
);
/** keyword regex, descriptor, value; later matches win ("less dark"). */
const DESCRIPTOR_KEYWORDS: [RegExp, string, number][] = [
  [/\bdark(?:er)?\b|\bgrim(?:dark)?\b|\bbleak\b/, 'darkness', 0.6],
  [/\bcoz(?:y|ier)|\bcosy\b|\bgentle\b|\blighter\b|\bless (?:bleak|dark)/, 'darkness', -0.6],
  [/\bfast(?:er|-paced)?\b|\bgripping\b|\bpage[- ]turner/, 'pace', 0.6],
  [/\bslow(?:er)?\b|\bslow[- ]burn/, 'pace', -0.5],
  [/\beas(?:y|ier)\b|\blight read\b/, 'complexity_level', -0.5],
  [/\bdense\b|\bcomplex\b|\bliterary\b/, 'complexity_level', 0.4],
];
const ASPECT_MODIFIERS: [RegExp, AspectName, number][] = [
  [/\bfunn(?:y|ier)\b|\bhumou?r\b/, 'humor', 0.5],
  [/\bmake me cry\b|\bcry\b|\btear-?jerker\b|\bemotional\b|\bmoving\b/, 'emotional_impact', 0.6],
  [/\bcharacter[- ]driven\b/, 'characters', 0.6],
  [/\batmospheric\b|\bimmersive\b/, 'world_building', 0.5],
  [/\bplot[- ]driven\b|\btwisty\b/, 'plot', 0.5],
];
const DESCRIPTOR_ASPECT: Record<string, AspectName> = {
  darkness: 'tone_dark',
  pace: 'pacing',
  complexity_level: 'complexity',
};
const ASPECT_KEYWORDS: Record<AspectName, string[]> = {
  plot: ['plot', 'story', 'twist', 'twists', 'mystery'],
  writing_style: ['prose', 'writing', 'written', 'sentences', 'lyrical'],
  characters: ['character', 'characters', 'protagonist', 'found family', 'friendship'],
  world_building: ['world', 'worldbuilding', 'world-building', 'setting', 'magic system', 'atmosphere'],
  pacing: ['pacing', 'pace', 'dragged', 'drags', 'page-turner', 'slow', 'rushed'],
  editing_quality: ['typo', 'typos', 'editing', 'translation'],
  dialogue: ['dialogue', 'banter', 'conversations'],
  humor: ['funny', 'humor', 'humour', 'witty', 'hilarious'],
  emotional_impact: ['cried', 'moving', 'emotional', 'heartbreaking', 'touching', 'tears'],
  ending: ['ending', 'conclusion', 'finale', 'cliffhanger'],
  complexity: ['confusing', 'complex', 'dense', 'layered'],
  tone_dark: ['dark', 'bleak', 'grim', 'disturbing', 'cozy', 'cosy'],
};
const POSITIVE = new Set(
  'wonderful loved love great gorgeous brilliant beautiful beautifully gripping funny moving perfect fantastic excellent enjoyed satisfying lovable warm'.split(
    ' ',
  ),
);
const NEGATIVE = new Set(
  'dragged boring tedious flat confusing hated weak rushed dull awful disappointing predictable annoying bad'.split(
    ' ',
  ),
);
const NEGATION = /\b(?:not|no|never|hate|avoid|dislike|nothing)\b/;
const LIKE_RE = /\b(?:like|similar to)\s+(.+?)(?:\s+but\b.*)?$/i;
const BY_RE = /\b(?:by|more)\s+(.+?)(?:\s+but\b.*)?$/i;
const LAST_READ_RE = /\blike (?:my|the) (?:last|latest|most recent) (?:read|book)\b/i;
const SPOILER =
  /\bdies\b|\bdied\b|\bkilled\b|turns out|the ending|twist (?:is|was)|revealed to be|the killer|ends up/i;
const MODEL_ROWS: [string, string][] = [
  ['M0', 'Popularity'],
  ['M1', 'ALS'],
  ['M2', 'LightGCN, raw'],
  ['M2n', 'LightGCN, normalized'],
  ['M2p', 'Projection hybrid'],
  ['M2s', 'Projection, shuffled text'],
  ['M3', 'Content-only'],
  ['M4', 'Ranker: CF + META + USER + SOURCE'],
  ['M5', 'M4 + CONTENT + REVIEW_EMB'],
  ['M6', 'M4 + ASPECT'],
  ['M7', 'M4 + CONTENT + REVIEW_EMB + ASPECT'],
  ['M8', 'Full LitSense'],
  ['M8a', 'M8 - AUTHOR'],
  ['M8b', 'M8 - ASPECT'],
];

interface Profile {
  n: number;
  bucket: Bucket;
  seen: Set<number>;
  stars: Map<number, number>;
  /** rated >= 4, newest first */
  liked: number[];
  genreAff: Map<string, number>;
  /** author -> most recent liked book by them */
  favAuthors: Map<string, number>;
  seriesProgress: Map<string, number>;
  muted: Set<string>;
  onboardingGenres: Set<string>;
  aspectPref: Map<AspectName, number>;
  descriptorPref: Map<string, number>;
  /** newest finished or rated book, for "like my last read" */
  lastRead: number | null;
}

const isAspect = (a: string): a is AspectName => a in ASPECT_LABELS;
const round = (x: number, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

function reject(message: string): never {
  throw new ModelServiceError('rejected', message, 'mock', 422);
}

function book(id: number): MockBook {
  const b = BOOKS[id];
  if (!b) reject(`unknown book_id ${id}`);
  return b;
}

function checkIds(ids: Iterable<number>): void {
  for (const id of ids) book(id);
}

function profileOf(state: UserState): Profile {
  checkIds([
    ...state.ratings.map((e) => e.book_id),
    ...state.reading_list.map((e) => e.book_id),
    ...state.dismissed,
    ...state.viewed,
    ...state.onboarding_picks,
    ...state.review_analyses.flatMap((r) => (r.book_id === null ? [] : [r.book_id])),
  ]);
  const ratings = [...state.ratings].sort((a, b) => b.ts - a.ts);
  const n = ratings.length + 0.5 * state.reading_list.length;
  const bucket = BUCKET_LOWER.filter(([, lower]) => lower <= n).at(-1)?.[0] ?? 'cold';
  const genreAff = new Map<string, number>();
  const add = (id: number, w: number) => {
    for (const g of book(id).genres) genreAff.set(g, (genreAff.get(g) ?? 0) + w);
  };
  for (const e of ratings) add(e.book_id, (e.stars - 3) / 2);
  for (const e of state.reading_list) add(e.book_id, 0.5);
  for (const id of state.onboarding_picks) add(id, 1);
  const onboarding = state.onboarding;
  for (const g of onboarding?.liked_genres ?? []) genreAff.set(g, (genreAff.get(g) ?? 0) + 1);
  for (const g of onboarding?.disliked_genres ?? []) genreAff.set(g, (genreAff.get(g) ?? 0) - 1);

  const liked = ratings.filter((e) => e.stars >= 4).map((e) => e.book_id);
  const favAuthors = new Map<string, number>();
  for (const id of liked) if (!favAuthors.has(book(id).author)) favAuthors.set(book(id).author, id);

  const finishedEvents = [
    ...ratings.map((e) => ({ id: e.book_id, ts: e.ts })),
    ...state.reading_list.filter((e) => e.status === 'read').map((e) => ({ id: e.book_id, ts: e.ts })),
  ].sort((a, b) => b.ts - a.ts);
  const seriesProgress = new Map<string, number>();
  for (const { id } of finishedEvents) {
    const b = book(id);
    if (b.series_id && b.series_pos) {
      seriesProgress.set(b.series_id, Math.max(seriesProgress.get(b.series_id) ?? 0, b.series_pos));
    }
  }

  const aspectPref = new Map<AspectName, number>();
  const bump = (a: string, v: number) => {
    if (isAspect(a)) aspectPref.set(a, Math.max(-1, Math.min(1, (aspectPref.get(a) ?? 0) + v)));
  };
  for (const a of onboarding?.positive_aspects ?? []) bump(a, 0.5);
  for (const a of onboarding?.negative_aspects ?? []) bump(a, -0.5);
  for (const a of state.overrides.pinned_aspects) bump(a, 0.5);
  for (const r of state.review_analyses) for (const [a, v] of Object.entries(r.aspects)) bump(a, 0.6 * v);

  const seen = new Set<number>([
    ...ratings.map((e) => e.book_id),
    ...state.reading_list.filter((e) => e.status === 'read' || e.status === 'dropped').map((e) => e.book_id),
    ...state.dismissed,
    ...state.onboarding_picks,
  ]);

  return {
    n,
    bucket,
    seen,
    stars: new Map(ratings.map((e) => [e.book_id, e.stars])),
    liked,
    genreAff,
    favAuthors,
    seriesProgress,
    muted: new Set(state.overrides.muted_genres),
    onboardingGenres: new Set(onboarding?.liked_genres ?? []),
    aspectPref,
    descriptorPref: new Map(Object.entries(onboarding?.descriptors ?? {})),
    lastRead: finishedEvents[0]?.id ?? null,
  };
}

const centered = (b: MockBook, a: AspectName) => (b.aspects[a] - 50) / 50;

function aspectFit(b: MockBook, prof: Profile): number {
  if (!prof.aspectPref.size) return 0;
  let total = 0;
  for (const [a, v] of prof.aspectPref) total += v * centered(b, a);
  return total / prof.aspectPref.size;
}

function descriptorFit(b: MockBook, deltas: Map<string, number>): number {
  let total = 0;
  for (const [d, v] of deltas) {
    const a = DESCRIPTOR_ASPECT[d];
    if (a) total += v * centered(b, a);
  }
  return total;
}

function score(b: MockBook, prof: Profile): number {
  let affinity = 0;
  for (const g of b.genres) affinity += prof.genreAff.get(g) ?? 0;
  return round(
    b.pop +
      0.3 * Math.tanh(affinity) +
      0.5 * Number(prof.favAuthors.has(b.author)) +
      0.25 * aspectFit(b, prof) +
      0.15 * descriptorFit(b, prof.descriptorPref),
  );
}

function passes(b: MockBook, f: Filters | null | undefined): boolean {
  if (!f) return true;
  return (
    (f.min_year === null || b.year >= f.min_year) &&
    (f.max_year === null || b.year <= f.max_year) &&
    (f.min_pages === null || b.pages >= f.min_pages) &&
    (f.max_pages === null || b.pages <= f.max_pages) &&
    (!f.genres_include.length || b.genres.some((g) => f.genres_include.includes(g))) &&
    !b.genres.some((g) => f.genres_exclude.includes(g))
  );
}

/** Main-feed eligibility: unseen, not muted, and not ahead of the reader in its series. */
function allowed(b: MockBook, prof: Profile): boolean {
  if (prof.seen.has(b.book_id) || b.genres.some((g) => prof.muted.has(g))) return false;
  if (b.series_pos === null || b.series_pos <= 1) return true;
  return (prof.seriesProgress.get(b.series_id ?? '') ?? 0) >= b.series_pos;
}

function rank(prof: Profile, filters: Filters | null, exclude: Set<number>): MockBook[] {
  return BOOKS.filter((b) => !exclude.has(b.book_id) && allowed(b, prof) && passes(b, filters)).sort(
    (a, b) => score(b, prof) - score(a, prof) || a.book_id - b.book_id,
  );
}

function similar(bookId: number, prof: Profile, alsoExclude: Set<number>): MockBook[] {
  const a = book(bookId);
  const sim = (b: MockBook) =>
    2 * Number(a.genres[0] === b.genres[0]) +
    b.genres.filter((g) => a.genres.includes(g)).length +
    1.5 * Number(a.author === b.author) +
    1.5 * Number(a.neighbors.includes(b.book_id)) -
    Math.abs(a.year - b.year) / 100 +
    0.1 * score(b, prof);
  return BOOKS.filter((b) => b.book_id !== bookId && !alsoExclude.has(b.book_id) && allowed(b, prof)).sort(
    (x, y) => sim(y) - sim(x) || x.book_id - y.book_id,
  );
}

function interleave(lists: MockBook[][]): MockBook[] {
  const out: MockBook[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i += 1) {
    for (const l of lists) {
      const b = l[i];
      if (b && !out.includes(b)) out.push(b);
    }
  }
  return out;
}

function continueSeries(prof: Profile): RecItem[] {
  const next = BOOKS.filter(
    (b) =>
      b.series_id !== null &&
      prof.seriesProgress.has(b.series_id) &&
      b.series_pos === (prof.seriesProgress.get(b.series_id) ?? 0) + 1 &&
      !prof.seen.has(b.book_id),
  );
  return next.map((b, i) => recItem(b, i + 1, prof, 'Next in a series you are reading', ['item_item']));
}

function strongAspects(b: MockBook, prof: Profile): AspectStrength[] {
  return ASPECTS.map((a, i) => ({ a, i, v: prof.aspectPref.get(a) ?? 0 }))
    .filter(({ v, i }) => v > 0.3 && (b.pos[i] ?? 0) >= 0.6)
    .sort((x, y) => (b.pos[y.i] ?? 0) - (b.pos[x.i] ?? 0))
    .slice(0, 3)
    .map(({ a, i }) => ({
      aspect: a,
      label: ASPECT_LABELS[a],
      strength: round(b.pos[i] ?? 0, 3),
      n: Math.round((b.mention[i] ?? 0) * Math.min(b.ratings_count, 5000)),
    }));
}

function weakAspects(b: MockBook, prof: Profile): AspectStrength[] {
  const out: AspectStrength[] = [];
  for (const [a, v] of prof.aspectPref) {
    const i = ASPECTS.indexOf(a);
    const value = centered(b, a);
    // a disliked aspect the book is strong in, or a valued aspect the book is weak in
    if ((v < -0.3 && value > 0.4) || (v > 0.3 && value < -0.1)) {
      out.push({ aspect: a, label: ASPECT_LABELS[a], strength: round(b.neg[i] ?? 0, 3), n: 0 });
    }
  }
  return out.slice(0, 2);
}

function snippetFor(b: MockBook, aspect?: AspectName): Snippet | null {
  const sentences = b.reviews.flatMap((r, ri) =>
    r.text.split(/(?<=[.!?])\s+/).map((text, si) => ({
      text,
      ref: b.book_id * 100 + ri * 10 + si,
      votes: 3 + ((b.book_id + ri + si) % 17),
    })),
  );
  const safe = sentences.filter((s) => s.text.length >= 40 && s.text.length <= 220 && !SPOILER.test(s.text));
  const pick =
    (aspect && safe.find((s) => ASPECT_KEYWORDS[aspect].some((k) => s.text.toLowerCase().includes(k)))) ??
    safe[0];
  if (!pick) return null;
  const detected =
    aspect ??
    ASPECTS.find((a) => ASPECT_KEYWORDS[a].some((k) => pick.text.toLowerCase().includes(k))) ??
    'writing_style';
  return { text: pick.text, review_ref: pick.ref, helpful_votes: pick.votes, aspect: detected };
}

/** First matching reason template, in the order of CLAUDE.md s12.5. */
function reasonFor(b: MockBook, prof: Profile): [string, string[]] {
  const likedByAuthor = prof.favAuthors.get(b.author);
  if (likedByAuthor !== undefined) {
    return [`Because you loved ${b.author}'s ${book(likedByAuthor).title}`, ['author', 'popularity']];
  }
  const strong = strongAspects(b, prof)[0];
  if (strong) {
    const pct = Math.round(strong.strength * 100);
    return [
      `Readers praise its ${strong.label} (${pct}% of mentions), something you value`,
      ['aspect', 'semantic'],
    ];
  }
  const same = prof.liked.find((id) => book(id).genres[0] === b.genres[0]);
  if (same !== undefined) {
    return [
      `Similar to ${book(same).title}, which you rated ${prof.stars.get(same)}★`,
      ['item_item', 'popularity'],
    ];
  }
  const theme = b.genres.find((g) => prof.onboardingGenres.has(g));
  if (theme) return [`Matches what you described: ${theme.toLowerCase()}`, ['semantic', 'popularity']];
  if (b.longtail && prof.n >= 5) return ['A lesser-known pick that fits your taste', ['longtail']];
  if (prof.bucket === 'cold' && !prof.genreAff.size)
    return ['Popular with readers right now', ['popularity']];
  return [`Popular with ${b.genres[0]} readers right now`, ['popularity']];
}

function evidenceFor(b: MockBook, prof: Profile, sources: string[]): Evidence {
  const similarLiked = prof.liked
    .filter((id) => book(id).genres.some((g) => b.genres.includes(g)))
    .slice(0, 3)
    .map((id) => ({ book_id: id, title: book(id).title, stars: prof.stars.get(id) ?? 0 }));
  const positives = strongAspects(b, prof);
  return {
    book: { book_id: b.book_id, title: b.title, author: b.author, genres: b.genres },
    user_evidence: {
      top_positive_aspects: positives,
      top_negative_aspects: weakAspects(b, prof),
      similar_liked_items: similarLiked,
      favorite_author: prof.favAuthors.has(b.author) ? b.author : null,
    },
    item_evidence: {
      aspect_profile: Object.fromEntries(
        ASPECTS.map((a, i) => [a, round((b.pos[i] ?? 0) - (b.neg[i] ?? 0), 3)]),
      ),
      mention_rates: Object.fromEntries(ASPECTS.map((a, i) => [a, b.mention[i] ?? 0])),
      pos_rates: Object.fromEntries(ASPECTS.map((a, i) => [a, b.pos[i] ?? 0])),
      snippet: snippetFor(b, positives[0]?.aspect as AspectName | undefined),
    },
    signals: {
      sources,
      cf_rank: null,
      semantic_rank: null,
      aspect_match: prof.aspectPref.size ? round(aspectFit(b, prof), 3) : null,
      bucket: prof.bucket,
    },
  };
}

function recItem(b: MockBook, r: number, prof: Profile, reason?: string | null, sources?: string[]): RecItem {
  const [defaultReason, defaultSources] = reasonFor(b, prof);
  const src = sources ?? defaultSources;
  return {
    book_id: b.book_id,
    rank: r,
    score: score(b, prof),
    sources: src,
    reason: reason ?? defaultReason,
    reason_method: 'template',
    evidence: evidenceFor(b, prof, src),
  };
}

const itemsFrom = (books: MockBook[], prof: Profile, source: string) =>
  books.map((b, i) => recItem(b, i + 1, prof, null, [source]));

function contentWords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOPWORDS.has(w)));
}

const hasWord = (text: string, word: string) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

function looksBookish(low: string): boolean {
  if (/\b(?:books?|reads?|novels?|recommend|stor(?:y|ies)|authors?|pages|surprise|mood)\b/.test(low))
    return true;
  return (
    GENRES.some((g) => low.includes(g.toLowerCase())) ||
    DESCRIPTOR_KEYWORDS.some(([p]) => p.test(low)) ||
    ASPECT_MODIFIERS.some(([p]) => p.test(low))
  );
}

function descriptorLabel(name: string, value: number): string {
  const labels: Record<string, [string, string]> = {
    darkness: ['cozier', 'darker'],
    pace: ['slower', 'faster'],
    complexity_level: ['easier', 'denser'],
  };
  const pair = labels[name] ?? [`less ${name}`, `more ${name}`];
  return value > 0 ? pair[1] : pair[0];
}

function chipsOf(session: SessionState): Chip[] {
  const chips: Chip[] = session.anchor_ids.map((id) => ({
    key: `anchor:book:${id}`,
    label: `like ${book(id).title}`,
  }));
  chips.push(...session.anchor_authors.map((a) => ({ key: 'anchor:author', label: `by ${a}` })));
  chips.push(
    ...Object.entries(session.descriptor_deltas).map(([d, v]) => ({
      key: `descriptor:${d}`,
      label: descriptorLabel(d, v),
    })),
  );
  chips.push(
    ...Object.entries(session.aspect_deltas).map(([a, v]) => ({
      key: `aspect:${a}`,
      label: `${v > 0 ? 'more' : 'less'} ${isAspect(a) ? ASPECT_LABELS[a] : a}`,
    })),
  );
  const f = session.filters;
  const filterChips: [keyof Filters, number | null, string][] = [
    ['max_pages', f.max_pages, 'under {} pages'],
    ['min_pages', f.min_pages, 'over {} pages'],
    ['min_year', f.min_year, 'from {}'],
    ['max_year', f.max_year, 'before {}'],
  ];
  for (const [key, value, label] of filterChips) {
    if (value !== null) chips.push({ key: `filter:${key}`, label: label.replace('{}', String(value)) });
  }
  chips.push(...f.genres_include.map((g) => ({ key: `filter:genres_include:${g}`, label: `only ${g}` })));
  chips.push(...f.genres_exclude.map((g) => ({ key: `filter:genres_exclude:${g}`, label: `no ${g}` })));
  return chips;
}

/** Applies mood, length and era words to the session; true if any matched. */
function applyModifiers(session: SessionState, low: string): boolean {
  let found = false;
  for (const [pattern, name, value] of DESCRIPTOR_KEYWORDS) {
    if (pattern.test(low)) {
      session.descriptor_deltas[name] = Math.max(-1, Math.min(1, value));
      found = true;
    }
  }
  for (const [pattern, aspect, value] of ASPECT_MODIFIERS) {
    if (pattern.test(low)) {
      session.aspect_deltas[aspect] = value;
      found = true;
    }
  }
  const anchorPages = session.anchor_ids[0] !== undefined ? book(session.anchor_ids[0]).pages : null;
  let m: RegExpMatchArray | null;
  if (/\bshorter\b/.test(low)) {
    session.filters.max_pages = anchorPages ? Math.floor(0.8 * anchorPages) : 300;
    found = true;
  } else if ((m = low.match(/\bunder (\d{2,4}) pages\b/))) {
    session.filters.max_pages = Number(m[1]);
    found = true;
  } else if (/\bshort\b|\bquick read\b|\bfinish tonight\b/.test(low)) {
    session.filters.max_pages = 300;
    found = true;
  }
  if (/\blonger\b/.test(low) && anchorPages) {
    session.filters.min_pages = Math.floor(1.2 * anchorPages);
    found = true;
  } else if ((m = low.match(/\bover (\d{2,4}) pages\b/))) {
    session.filters.min_pages = Number(m[1]);
    found = true;
  }
  if (/\brecent\b/.test(low)) {
    session.filters.min_year = new Date().getUTCFullYear() - 5;
    found = true;
  }
  if (/\bclassics?\b/.test(low)) {
    session.filters.max_year = 1980;
    found = true;
  }
  if ((m = low.match(/\b(?:nothing|not) older than ((?:19|20)\d\d)|\b(?:after|since) ((?:19|20)\d\d)/))) {
    session.filters.min_year = Number(m[1] ?? m[2]);
    found = true;
  }
  if ((m = low.match(/(?<!nothing )(?<!not )\b(?:older than|before) ((?:19|20)\d\d)/))) {
    session.filters.max_year = Number(m[1]);
    found = true;
  }
  return found;
}

function chatResults(prof: Profile, session: SessionState, query: string | null): MockBook[] {
  const blocked = new Set([...session.excluded_ids, ...session.anchor_ids]);
  let base: MockBook[];
  if (session.anchor_authors.length) {
    const names = session.anchor_authors.map(norm);
    base = names
      .flatMap((n) => (BY_AUTHOR.get(n) ?? []).map((id) => book(id)))
      .filter((b) => allowed(b, prof));
  } else if (session.anchor_ids[0] !== undefined) {
    base = similar(session.anchor_ids[0], prof, new Set());
  } else {
    const hits = query ? searchBooks(query, 50, null) : [];
    base = hits.length
      ? hits.map((h) => book(h.book_id)).filter((b) => allowed(b, prof))
      : rank(prof, null, new Set());
  }
  const position = new Map(base.map((b, i) => [b.book_id, i]));
  const deltas = new Map(Object.entries(session.descriptor_deltas));
  const nudge = (b: MockBook) => {
    let total = descriptorFit(b, deltas);
    for (const [a, v] of Object.entries(session.aspect_deltas)) if (isAspect(a)) total += v * centered(b, a);
    return total;
  };
  const pool = base.filter((b) => !blocked.has(b.book_id) && passes(b, session.filters));
  const len = Math.max(1, base.length);
  return pool
    .sort(
      (a, b) =>
        (position.get(a.book_id) ?? 0) / len - nudge(a) - ((position.get(b.book_id) ?? 0) / len - nudge(b)) ||
        a.book_id - b.book_id,
    )
    .slice(0, CHAT_K);
}

function pushHistory(session: SessionState, role: 'user' | 'assistant', text: string): void {
  session.history = [...session.history, { role, text: text.slice(0, 300) }].slice(-6);
}

function chatReply(
  session: SessionState,
  text: string,
  intro: string,
  picks: MockBook[],
  intent: string,
  prof: Profile,
): ChatReply {
  const items = picks.map((b) => {
    const [reason, sources] = reasonFor(b, prof);
    return { book_id: b.book_id, reason, evidence: evidenceFor(b, prof, sources) };
  });
  session.turn += 1;
  if (intent !== 'explain_recommendation' && intent !== 'out_of_scope') {
    session.last_shown = picks.map((b) => b.book_id);
    session.last_request = text || session.last_request;
  }
  if (text) pushHistory(session, 'user', text);
  pushHistory(session, 'assistant', intro);
  let followup: string | null =
    intent === 'out_of_scope' ? null : 'Want them shorter, cozier or more recent?';
  if (intent === 'explain_recommendation') followup = 'Ask about another pick, or refine the list.';
  if (intent !== 'out_of_scope' && intent !== 'explain_recommendation' && !picks.length) {
    followup = 'Try removing one of the active filters.';
  }
  return {
    intro,
    items,
    followup,
    chips: chipsOf(session),
    clarification: null,
    session,
    method: 'template',
    intent,
  };
}

function searchBooks(query: string, k: number, filters: Filters | null): SearchHit[] {
  const words = contentWords(query);
  if (!words.size) return [];
  const hits: SearchHit[] = [];
  for (const b of BOOKS) {
    if (!passes(b, filters)) continue;
    const count = (set: Set<string>) => [...words].filter((w) => set.has(w)).length;
    const t = count(contentWords(b.title));
    const a = count(contentWords(b.author));
    const d = count(contentWords(`${b.genres.join(' ')} ${b.description} ${b.tagline} ${b.moods.join(' ')}`));
    if (t || a || d) {
      const s = Math.min(1, (3 * t + 3 * a + d) / (3 * words.size));
      hits.push({ book_id: b.book_id, score: round(s, 4), matched: t ? 'title' : a ? 'author' : 'semantic' });
    }
  }
  hits.sort(
    (x, y) => y.score - x.score || book(y.book_id).pop - book(x.book_id).pop || x.book_id - y.book_id,
  );
  return hits.slice(0, k);
}

function display(kind: 'title' | 'author', key: string): string {
  const ids = (kind === 'title' ? BY_TITLE : BY_AUTHOR).get(key) ?? [];
  const b = book(ids[0] ?? -1);
  return kind === 'title' ? b.title : b.author;
}

function resolve(query: string): EntityMatch {
  const q = norm(query);
  if (!q) return { kind: 'none', book_ids: [], author: null, options: [] };
  const titleIds = BY_TITLE.get(q);
  if (titleIds) return { kind: 'title', book_ids: titleIds, author: null, options: [] };
  const authorIds = BY_AUTHOR.get(q);
  if (authorIds)
    return { kind: 'author', book_ids: authorIds, author: book(authorIds[0] ?? -1).author, options: [] };
  // whole-word containment ("people" -> Anxious People, Normal People)
  if (q.length >= 4) {
    const re = new RegExp(`\\b${q}\\b`);
    const titles = [...BY_TITLE.keys()].filter((t) => re.test(t));
    const authors = [...BY_AUTHOR.keys()].filter((a) => re.test(a));
    const options = [...titles.map((t) => display('title', t)), ...authors.map((a) => display('author', a))];
    if (options.length > 1)
      return { kind: 'ambiguous', book_ids: [], author: null, options: options.slice(0, 3) };
    if (titles.length === 1 && titles[0]) return resolve(display('title', titles[0]));
    if (authors.length === 1 && authors[0]) return resolve(display('author', authors[0]));
  }
  const scored = [
    ...[...BY_TITLE.keys()].map((key) => ({ s: similarity(q, key), kind: 'title' as const, key })),
    ...[...BY_AUTHOR.keys()].map((key) => ({ s: similarity(q, key), kind: 'author' as const, key })),
  ].sort((a, b) => b.s - a.s);
  const close = scored.filter((x) => x.s >= 0.8);
  const [first, second] = close;
  if (!first) return { kind: 'none', book_ids: [], author: null, options: [] };
  if (second && first.s - second.s < 0.05) {
    return {
      kind: 'ambiguous',
      book_ids: [],
      author: null,
      options: close.slice(0, 3).map((x) => display(x.kind, x.key)),
    };
  }
  return resolve(display(first.kind, first.key));
}

function explainText(state: UserState, bookId: number): Explanation {
  const prof = profileOf(state);
  const b = book(bookId);
  const [reason, sources] = reasonFor(b, prof);
  const evidence = evidenceFor(b, prof, sources);
  const praised = ASPECTS.map((a, i) => ({ a, p: (b.pos[i] ?? 0) * (b.mention[i] ?? 0) }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 2)
    .map((x) => ASPECT_LABELS[x.a]);
  const text = `${reason}. Readers most often praise its ${praised.join(' and ')}.`;
  return { book_id: bookId, text, method: 'template', evidence, rejections: [] };
}

export class MockModelService implements ModelService {
  readonly mode = 'mock' as const;

  async health(_ctx: CallContext): Promise<ModelHealth> {
    return {
      status: 'ok',
      ready: true,
      mock: true,
      api_version: '0.1.0',
      bundle_version: MOCK_MODEL_VERSION,
      ranker: false,
      llm: false,
      n_books: N_BOOKS,
    };
  }

  async recommend(
    _ctx: CallContext,
    a: { state: UserState; k: number; filters?: FiltersInput | null; exclude?: number[] },
  ): Promise<RecResponse> {
    const started = performance.now();
    if (a.k < 1) reject('k must be >= 1');
    const prof = profileOf(a.state);
    checkIds(a.exclude ?? []);
    const filters = a.filters ? Filters.parse(a.filters) : null;
    const ranked = rank(prof, filters, new Set(a.exclude ?? [])).slice(0, a.k);
    return {
      items: ranked.map((b, i) => recItem(b, i + 1, prof)),
      continue_series: continueSeries(prof),
      model_version: MOCK_MODEL_VERSION,
      profile_version: a.state.profile_version,
      bucket: prof.bucket,
      degraded: false,
      latency_ms: round(performance.now() - started, 3),
    };
  }

  async homeRails(ctx: CallContext, a: { state: UserState }): Promise<HomeRails> {
    const { state } = a;
    const prof = profileOf(state);
    const anchors = prof.liked.length ? prof.liked.slice(0, 2) : state.onboarding_picks.slice(0, 2);
    const trending = [...BOOKS]
      .sort((x, y) => y.pop - x.pop || x.book_id - y.book_id)
      .filter((b) => allowed(b, prof));
    const favorites = new Set(
      [...prof.favAuthors.keys()].filter((au) => (BY_AUTHOR.get(norm(au)) ?? []).length >= 2),
    );
    const ranked = rank(prof, null, new Set());
    const byFav = ranked.filter((b) => favorites.has(b.author));
    const viewed = state.viewed.slice(0, 3).map((v) => similar(v, prof, new Set(state.viewed)));
    const wanted = state.reading_list.filter((e) => e.status === 'want_to_read').map((e) => e.book_id);
    const fromList = wanted.slice(0, 3).map((w) => similar(w, prof, new Set(wanted)));
    const gems = prof.n >= 5 ? ranked.filter((b) => b.longtail) : [];
    const top = await this.recommend(ctx, { state, k: 10 });
    return {
      top_picks: top.items,
      because_you_liked: await Promise.all(
        anchors.map(async (anchor) => ({
          anchor_book_id: anchor,
          items: await this.similarBooks(ctx, { bookId: anchor, k: 10, state }),
        })),
      ),
      trending: trending
        .slice(0, 20)
        .map((b, i) => recItem(b, i + 1, prof, 'Popular with readers right now', ['popularity'])),
      more_by_authors: byFav.slice(0, 10).map((b, i) => recItem(b, i + 1, prof)),
      continue_exploring: itemsFrom(interleave(viewed).slice(0, 10), prof, 'item_item'),
      hidden_gems: gems
        .slice(0, 10)
        .map((b, i) => recItem(b, i + 1, prof, 'A lesser-known pick that fits your taste', ['longtail'])),
      from_reading_list: itemsFrom(interleave(fromList).slice(0, 10), prof, 'item_item'),
      continue_series: continueSeries(prof),
    };
  }

  async similarBooks(
    _ctx: CallContext,
    a: { bookId: number; k: number; state?: UserState | null },
  ): Promise<RecItem[]> {
    const anchor = book(a.bookId);
    const prof = profileOf(a.state ?? emptyState());
    const stars = prof.stars.get(a.bookId);
    const reason = `Similar to ${anchor.title}${stars ? `, which you rated ${stars}★` : ''}`;
    return similar(a.bookId, prof, new Set())
      .slice(0, a.k)
      .map((b, i) => recItem(b, i + 1, prof, reason, ['item_item']));
  }

  async moreByAuthor(
    _ctx: CallContext,
    a: { bookId: number; k: number; state?: UserState | null },
  ): Promise<RecItem[]> {
    const anchor = book(a.bookId);
    const prof = profileOf(a.state ?? emptyState());
    const same = (BY_AUTHOR.get(norm(anchor.author)) ?? [])
      .filter((i) => i !== a.bookId && !prof.seen.has(i) && !prof.muted.has(book(i).genres[0] ?? ''))
      .map(book)
      .sort((x, y) => (x.series_pos ?? 99) - (y.series_pos ?? 99) || y.pop - x.pop || x.book_id - y.book_id);
    return same.slice(0, a.k).map((b, i) => recItem(b, i + 1, prof, `More by ${anchor.author}`, ['author']));
  }

  async semanticSearch(_ctx: CallContext, a: { query: string; k: number; filters?: FiltersInput | null }) {
    return searchBooks(a.query, a.k, a.filters ? Filters.parse(a.filters) : null);
  }

  async resolveEntities(_ctx: CallContext, a: { query: string }): Promise<EntityMatch> {
    return resolve(a.query);
  }

  async onboardingGrid(_ctx: CallContext, a: { n: number }): Promise<number[]> {
    const primaries = [...new Set(BOOKS.map((b) => b.primary_genre))].sort();
    const perGenre = primaries.map((g) =>
      BOOKS.filter((b) => b.primary_genre === g).sort(
        (x, y) => y.avg_rating * y.pop - x.avg_rating * x.pop || x.book_id - y.book_id,
      ),
    );
    return interleave(perGenre)
      .slice(0, a.n)
      .map((b) => b.book_id);
  }

  async parseOnboarding(_ctx: CallContext, a: { text: string; picks: number[] }): Promise<OnboardingResult> {
    checkIds(a.picks);
    const profile: OnboardingProfile = {
      liked_genres: [],
      disliked_genres: [],
      positive_aspects: [],
      negative_aspects: [],
      descriptors: {},
      themes: [],
      named_titles: [],
      named_authors: [],
    };
    for (const clause of a.text.toLowerCase().split(/[.;!?]|,|\bbut\b/)) {
      const negated = NEGATION.test(clause);
      for (const g of GENRES) {
        if (clause.includes(g.toLowerCase())) {
          const target = negated ? profile.disliked_genres : profile.liked_genres;
          if (!target.includes(g)) target.push(g);
        }
      }
      for (const [pattern, name, value] of DESCRIPTOR_KEYWORDS) {
        if (pattern.test(clause)) profile.descriptors[name] = negated ? -value : value;
      }
      for (const aspect of ASPECTS) {
        if (aspect === 'pacing' || aspect === 'tone_dark') continue;
        if (ASPECT_KEYWORDS[aspect].some((w) => hasWord(clause, w))) {
          const target = negated ? profile.negative_aspects : profile.positive_aspects;
          if (!target.includes(aspect)) target.push(aspect);
        }
      }
    }
    const low = norm(a.text);
    profile.named_titles = [...BY_TITLE.entries()]
      .filter(([t]) => t.length > 3 && low.includes(t))
      .map(([, ids]) => book(ids[0] ?? -1).title);
    profile.named_authors = [...BY_AUTHOR.entries()]
      .filter(([au]) => low.includes(au))
      .map(([, ids]) => book(ids[0] ?? -1).author);
    const resolved = [
      ...new Set([...a.picks, ...profile.named_titles.map((t) => BY_TITLE.get(norm(t))?.[0] ?? -1)]),
    ].filter((id) => id >= 0);
    const chips = [
      ...profile.liked_genres.map((g) => `Likes: ${g}`),
      ...profile.disliked_genres.map((g) => `Avoids: ${g}`),
      ...profile.positive_aspects.map((x) => `Values: ${ASPECT_LABELS[x as AspectName] ?? x}`),
      ...Object.entries(profile.descriptors).map(([d, v]) => `Prefers: ${descriptorLabel(d, v)}`),
    ];
    return { profile, resolved_picks: resolved, display_chips: chips, method: 'embed_only' };
  }

  async explain(_ctx: CallContext, a: { state: UserState; bookId: number }): Promise<Explanation> {
    return explainText(a.state, a.bookId);
  }

  async chatTurn(
    _ctx: CallContext,
    a: { state: UserState; session: SessionState | null; message: string },
  ): Promise<ChatReply> {
    const prof = profileOf(a.state);
    const session: SessionState = a.session
      ? SessionState.parse(JSON.parse(JSON.stringify(a.session)))
      : SessionState.parse({ session_id: randomUUID().replace(/-/g, '') });
    const text = a.message.trim();
    const low = text.toLowerCase();

    if (/\bwhy\b/.test(low)) return this.chatExplain(a.state, prof, session, text);

    let intent: string | null = null;
    if (!text) {
      intent = 'refine_previous';
    } else if (/\b(?:something else|not these|other ones?|different)\b/.test(low)) {
      session.excluded_ids = [...new Set([...session.excluded_ids, ...session.last_shown])];
      intent = 'refine_previous';
    } else if (/\bmore (?:by|from) (?:that|this|the same) author\b/.test(low)) {
      const source = (session.anchor_ids.length ? session.anchor_ids : session.last_shown)[0];
      if (source === undefined) {
        return chatReply(session, text, "Which book's author do you mean?", [], 'more_by_author', prof);
      }
      session.anchor_ids = [];
      session.anchor_authors = [book(source).author];
      intent = 'more_by_author';
    } else if (LAST_READ_RE.test(text)) {
      if (prof.lastRead === null) {
        return chatReply(
          session,
          text,
          'You have not finished a book here yet. Rate one and I will look for its echoes.',
          [],
          'similar_to',
          prof,
        );
      }
      session.anchor_ids = [prof.lastRead];
      session.anchor_authors = [];
      session.aspect_deltas = {};
      session.descriptor_deltas = {};
      session.filters = Filters.parse({});
      intent = 'similar_to';
    } else {
      // "like X" / "by Y", or a bare title or author (what the UI sends for a picked option)
      const m = LIKE_RE.exec(text) ?? BY_RE.exec(text);
      const match = resolve(m?.[1] ?? text);
      if (match.kind === 'ambiguous' && m) {
        session.turn += 1;
        pushHistory(session, 'user', text);
        return {
          intro: 'I found more than one match.',
          items: [],
          followup: null,
          chips: chipsOf(session),
          clarification: {
            question: 'Which one did you mean?',
            options: match.options.map((o) => ({ label: o, value: o })),
          },
          session,
          method: 'template',
          intent: 'similar_to',
        };
      }
      if (match.kind === 'title') {
        session.anchor_ids = match.book_ids.slice(0, 1);
        session.anchor_authors = [];
        session.aspect_deltas = {};
        session.descriptor_deltas = {};
        session.filters = Filters.parse({});
        intent = 'similar_to';
      } else if (match.kind === 'author') {
        session.anchor_ids = [];
        session.anchor_authors = [match.author ?? ''];
        intent = 'more_by_author';
      }
    }

    const modified = applyModifiers(session, low);
    let query: string | null = null;
    if (intent === null) {
      if (modified && session.turn) {
        intent = 'refine_previous';
      } else if (modified || looksBookish(low)) {
        session.anchor_ids = [];
        session.anchor_authors = [];
        intent = 'recommend_general';
        query = /\bsurprise\b/.test(low) ? null : text;
      } else {
        return chatReply(
          session,
          text,
          'I can only help with finding books. Try "something like <a title> but shorter".',
          [],
          'out_of_scope',
          prof,
        );
      }
    } else if (intent === 'similar_to' && modified) {
      intent = 'similar_to_with_modifier';
    }

    let picks = chatResults(prof, session, query);
    if (/\bsurprise\b/.test(low))
      picks = rank(prof, session.filters, new Set(session.excluded_ids)).slice(5, 5 + CHAT_K);
    const anchorTitle = session.anchor_ids[0] !== undefined ? book(session.anchor_ids[0]).title : 'that';
    const intros: Record<string, string> = {
      similar_to: `Here are books in the spirit of ${anchorTitle}.`,
      similar_to_with_modifier: `Here are books in the spirit of ${anchorTitle}, adjusted as asked.`,
      more_by_author: `More from ${session.anchor_authors[0] ?? 'that author'}.`,
      refine_previous: "Here's a refined set.",
      recommend_general: 'Here are some picks for that.',
    };
    const intro = picks.length
      ? (intros[intent] ?? intros.recommend_general ?? '')
      : 'Nothing in the catalogue matched those constraints.';
    return chatReply(session, text, intro, picks, intent, prof);
  }

  private chatExplain(state: UserState, prof: Profile, session: SessionState, text: string): ChatReply {
    if (!session.last_shown.length) {
      return chatReply(
        session,
        text,
        "I haven't suggested anything yet; ask me for some books first.",
        [],
        'explain_recommendation',
        prof,
      );
    }
    const ordinals: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    const low = text.toLowerCase();
    let index = Object.entries(ordinals).find(([w]) => low.includes(w))?.[1];
    if (index === undefined) {
      const m = low.match(/\b(?:#|number |no\.? ?)?([1-9])(?:st|nd|rd|th)?\b/);
      if (m) index = Number(m[1]);
    }
    const i = Math.min(index ?? 1, session.last_shown.length);
    const bookId = session.last_shown[i - 1] ?? session.last_shown[0] ?? 0;
    return chatReply(
      session,
      text,
      explainText(state, bookId).text,
      [book(bookId)],
      'explain_recommendation',
      prof,
    );
  }

  async bookInsights(_ctx: CallContext, a: { bookId: number }): Promise<BookInsights> {
    const b = book(a.bookId);
    const bars = ASPECTS.map((aspect, i) => ({
      aspect,
      label: ASPECT_LABELS[aspect],
      pos_rate: b.pos[i] ?? 0,
      neg_rate: b.neg[i] ?? 0,
      mention_rate: b.mention[i] ?? 0,
    }));
    const order = ASPECTS.map((_, i) => i);
    const best = [...order]
      .sort((x, y) => (b.pos[y] ?? 0) * (b.mention[y] ?? 0) - (b.pos[x] ?? 0) * (b.mention[x] ?? 0))
      .slice(0, 2);
    const worst =
      [...order].sort(
        (x, y) => (b.neg[y] ?? 0) * (b.mention[y] ?? 0) - (b.neg[x] ?? 0) * (b.mention[x] ?? 0),
      )[0] ?? 0;
    const label = (i: number) => ASPECT_LABELS[ASPECTS[i] as AspectName];
    const summary = `Readers most often praise its ${best.map(label).join(' and ')}; some find its ${label(worst)} weaker.`;
    const snippets = best
      .map((i) => snippetFor(b, ASPECTS[i]))
      .filter((s): s is Snippet => s !== null)
      .filter((s, i, arr) => arr.findIndex((x) => x.review_ref === s.review_ref) === i);
    return {
      book_id: b.book_id,
      aspect_bars: bars,
      review_summary: summary,
      snippets: snippets.length ? snippets : [snippetFor(b)].filter((s): s is Snippet => s !== null),
      n_reviews: Math.round(b.ratings_count / 12),
    };
  }

  async analyzeUserReview(_ctx: CallContext, a: { text: string }): Promise<ReviewAnalysis> {
    const sentences = a.text
      .trim()
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);
    const polarities = new Map<string, number[]>();
    for (const sentence of sentences) {
      for (const clause of sentence.split(/,?\s+\b(?:but|although|though|however|yet|whereas)\b\s+/)) {
        const words = clause.toLowerCase().match(/[a-z'-]+/g) ?? [];
        const s = words.filter((w) => POSITIVE.has(w)).length - words.filter((w) => NEGATIVE.has(w)).length;
        if (!s) continue;
        for (const aspect of ASPECTS) {
          if (ASPECT_KEYWORDS[aspect].some((k) => hasWord(clause.toLowerCase(), k))) {
            polarities.set(aspect, [...(polarities.get(aspect) ?? []), Math.tanh(s)]);
          }
        }
      }
    }
    return {
      book_id: null,
      ts: null,
      aspects: Object.fromEntries(
        [...polarities].map(([k, v]) => [
          k,
          Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 1000) / 1000,
        ]),
      ),
      spoiler_sentences: sentences.filter((s) => SPOILER.test(s)).length,
    };
  }

  async metricsReport(_ctx: CallContext): Promise<MetricsReport> {
    const names = ['ndcg@10', 'recall@20', 'precision@10', 'mrr@10', 'coverage@10'];
    return {
      is_mock: true,
      data_version: 'mock',
      generated_at: new Date().toISOString(),
      bundle_version: MOCK_MODEL_VERSION,
      dataset: { users: null, items: N_BOOKS, interactions: null, attrition: [], splits: {} },
      models: MODEL_ROWS.map(([id, name]) => ({
        id,
        name,
        mode: null,
        metrics: Object.fromEntries(names.map((m) => [m, null])),
        ci95: {},
      })),
      ablation: [],
      strata: [],
      longtail: [],
      coldstart: [],
      genai: { intent_field_accuracy: null, rejection_rates: {}, audit: {} },
    };
  }

  async catalogPage(_ctx: CallContext, a: { offset: number; limit: number }): Promise<CatalogPage> {
    if (!Number.isInteger(a.offset) || a.offset < 0) reject('offset must be a non-negative integer');
    if (!Number.isInteger(a.limit) || a.limit < 1 || a.limit > 1000) reject('limit must be 1 to 1000');
    const rows = catalogRows();
    return {
      bundle_version: MOCK_MODEL_VERSION,
      total: rows.length,
      offset: a.offset,
      limit: a.limit,
      items: rows.slice(a.offset, a.offset + a.limit),
    };
  }
}

function emptyState(): UserState {
  return {
    user_id: null,
    corpus_user_id: null,
    ratings: [],
    reading_list: [],
    dismissed: [],
    viewed: [],
    onboarding: null,
    onboarding_picks: [],
    onboarding_text: null,
    review_analyses: [],
    overrides: { muted_genres: [], pinned_aspects: [], disabled_ai: false },
    profile_version: 0,
  };
}
