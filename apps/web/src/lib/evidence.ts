import { ASPECT_LABELS, ASPECTS, type AspectName, type Evidence } from '@litsense/shared';

/** Prototype display order and numbering of the 12 aspects (same order as the core). */
export const ASPECT_ROWS = ASPECTS.map((key, i) => ({
  key,
  no: String(i + 1).padStart(2, '0'),
  label: ASPECT_LABELS[key],
}));

export const aspectLabel = (a: string) =>
  a in ASPECT_LABELS ? ASPECT_LABELS[a as AspectName] : a.replace(/_/g, ' ');

const SOURCE_LABELS: Record<string, string> = {
  cf: 'Readers with similar shelves (collaborative filtering)',
  semantic: 'Similar in meaning to what you like',
  item_item: 'Close to a book you rated',
  popularity: 'Popular right now',
  author: 'An author you rated highly',
  aspect: 'Strong on aspects you value',
  longtail: 'A lesser-known pick',
};
export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s.replace(/_/g, ' ');

export interface ParsedEvidence {
  positives: { aspect: string; label: string; strength: number }[];
  negatives: { aspect: string; label: string; strength: number }[];
  similarLiked: { bookId: number; title: string; stars: number }[];
  favoriteAuthor: string | null;
  posRates: Partial<Record<string, number>>;
  mentionRates: Partial<Record<string, number>>;
  snippet: { text: string; aspect: string } | null;
  sources: string[];
  bucket: string | null;
  rankedBy: string | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function numMap(v: unknown): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const [k, x] of Object.entries(rec(v))) {
    const n = num(x);
    if (n !== null) out[k] = n;
  }
  return out;
}

function strengths(v: unknown) {
  return arr(v).flatMap((x) => {
    const o = rec(x);
    const aspect = typeof o.aspect === 'string' ? o.aspect : null;
    if (!aspect) return [];
    return [
      {
        aspect,
        label: typeof o.label === 'string' ? o.label : aspectLabel(aspect),
        strength: num(o.strength) ?? 0,
      },
    ];
  });
}

/**
 * Reads the contract `Evidence` defensively: its four dicts are plain JSON whose keys are documented
 * in schemas.py but not typed, so every field is optional here.
 */
export function parseEvidence(e: Evidence | undefined | null): ParsedEvidence {
  const user = rec(e?.user_evidence);
  const item = rec(e?.item_evidence);
  const signals = rec(e?.signals);
  const snippet = rec(item.snippet);
  return {
    positives: strengths(user.top_positive_aspects),
    negatives: strengths(user.top_negative_aspects),
    similarLiked: arr(user.similar_liked_items).flatMap((x) => {
      const o = rec(x);
      const id = num(o.book_id);
      return id !== null && typeof o.title === 'string'
        ? [{ bookId: id, title: o.title, stars: num(o.stars) ?? 0 }]
        : [];
    }),
    favoriteAuthor: typeof user.favorite_author === 'string' ? user.favorite_author : null,
    posRates: numMap(item.pos_rates),
    mentionRates: numMap(item.mention_rates),
    snippet:
      typeof snippet.text === 'string' ? { text: snippet.text, aspect: String(snippet.aspect ?? '') } : null,
    sources: arr(signals.sources).filter((s): s is string => typeof s === 'string'),
    bucket: typeof signals.bucket === 'string' ? signals.bucket : null,
    rankedBy: typeof signals.ranked_by === 'string' ? signals.ranked_by : null,
  };
}

/** The aspects most worth showing on a card: highest positive rate weighted by how often they come up. */
export function topAspects(e: ParsedEvidence, n = 4): { key: string; label: string; value: number }[] {
  return Object.entries(e.posRates)
    .map(([key, pos]) => ({
      key,
      label: aspectLabel(key),
      value: pos ?? 0,
      weight: (pos ?? 0) * (e.mentionRates[key] ?? 0.3),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
    .map(({ key, label, value }) => ({ key, label, value: Math.round(value * 100) }));
}
