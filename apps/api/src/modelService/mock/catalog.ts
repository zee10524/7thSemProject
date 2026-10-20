import { ASPECTS, type AspectName, type CatalogBook } from '@litsense/shared';
import fixture from './catalog.fixture.json' with { type: 'json' };

export interface FixtureBook {
  book_id: number;
  canonical_id: string;
  slug: string;
  title: string;
  author: string;
  genres: string[];
  primary_genre: string;
  year: number;
  pages: number;
  description: string;
  image: string | null;
  isbn13: string | null;
  series_id: string | null;
  series_name: string | null;
  series_pos: number | null;
  avg_rating: number;
  ratings_count: number;
  tagline: string;
  moods: string[];
  cover: { c1: string; c2: string; ink: string; accent: string; motif: string; layout: string; font: string };
  aspects: Record<AspectName, number>;
  reviews: { text: string; rating: number }[];
  neighbors: number[];
}

export interface MockBook extends FixtureBook {
  /** log-scaled popularity in [0, 1] */
  pop: number;
  longtail: boolean;
  /** per aspect, ASPECTS order */
  mention: number[];
  pos: number[];
  neg: number[];
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Deterministic pseudo-random in [0, 1) from two integers (mulberry32 on a mixed seed). */
export function unitHash(a: number, b: number): number {
  let t = (a * 2654435761 + b * 40503 + 7) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

function build(): MockBook[] {
  const raw = (fixture as { books: FixtureBook[] }).books;
  const counts = raw.map((b) => b.ratings_count);
  const maxLog = Math.log1p(Math.max(...counts));
  const sorted = [...counts].sort((a, b) => a - b);
  const tailCut = sorted[Math.floor(0.8 * sorted.length)] ?? 0;
  return raw.map((b) => {
    const mention: number[] = [];
    const pos: number[] = [];
    const neg: number[] = [];
    ASPECTS.forEach((a, i) => {
      const s = b.aspects[a];
      const salience = Math.abs(s - 50) / 50;
      mention.push(round3(clamp(0.08 + 0.32 * salience + 0.2 * unitHash(b.book_id, i), 0.05, 0.6)));
      const p = clamp((s - 30) / 70, 0.05, 0.95);
      pos.push(round3(p));
      neg.push(round3(clamp((75 - s) / 110, 0.02, Math.min(0.6, 1 - p))));
    });
    return {
      ...b,
      pop: round3(Math.log1p(b.ratings_count) / maxLog),
      longtail: b.ratings_count < tailCut,
      mention,
      pos,
      neg,
    };
  });
}

export const BOOKS: readonly MockBook[] = build();
export const N_BOOKS = BOOKS.length;
export const GENRES: readonly string[] = [...new Set(BOOKS.flatMap((b) => b.genres))].sort();

export function norm(text: string): string {
  const t = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
  return t.replace(/^(?:the|a|an) /, '');
}

export const BY_TITLE = new Map<string, number[]>();
export const BY_AUTHOR = new Map<string, number[]>();
for (const b of BOOKS) {
  const t = norm(b.title);
  const a = norm(b.author);
  BY_TITLE.set(t, [...(BY_TITLE.get(t) ?? []), b.book_id]);
  BY_AUTHOR.set(a, [...(BY_AUTHOR.get(a) ?? []), b.book_id]);
}

/** Catalogue rows in the contract's CatalogBook shape. */
export function catalogRows(): CatalogBook[] {
  return BOOKS.map((b) => ({
    book_id: b.book_id,
    canonical_id: b.canonical_id,
    title: b.title,
    author: b.author,
    genres: b.genres,
    primary_genre: b.primary_genre,
    year: b.year,
    pages: b.pages,
    description: b.description,
    image: b.image,
    isbn13: b.isbn13,
    series_id: b.series_id,
    series_name: b.series_name,
    series_pos: b.series_pos,
  }));
}

/** Similarity ratio in [0, 1] from Levenshtein distance (stand-in for difflib.SequenceMatcher). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return 1 - (prev[b.length] ?? 0) / Math.max(a.length, b.length);
}
