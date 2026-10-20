import { describe, expect, it } from 'vitest';
import type { Evidence } from '@litsense/shared';
import { parseEvidence, topAspects } from './evidence';

const evidence: Evidence = {
  book: { book_id: 1, title: 'Circe', author: 'Madeline Miller', genres: ['Fantasy'] },
  user_evidence: {
    top_positive_aspects: [{ aspect: 'characters', label: 'characters', strength: 0.89, n: 120 }],
    top_negative_aspects: [{ aspect: 'pacing', label: 'pacing', strength: 0.3, n: 0 }],
    similar_liked_items: [{ book_id: 2, title: 'The Song of Achilles', stars: 5 }],
    favorite_author: 'Madeline Miller',
  },
  item_evidence: {
    pos_rates: { characters: 0.9, plot: 0.5, ending: 0.95 },
    mention_rates: { characters: 0.6, plot: 0.4, ending: 0.05 },
    snippet: { text: 'The prose is gorgeous.', aspect: 'writing_style', review_ref: 3, helpful_votes: 4 },
  },
  signals: { sources: ['cf', 'semantic'], bucket: 'warm', ranked_by: 'ranker' },
};

describe('parseEvidence', () => {
  it('reads every documented field', () => {
    const e = parseEvidence(evidence);
    expect(e.positives).toEqual([{ aspect: 'characters', label: 'characters', strength: 0.89 }]);
    expect(e.negatives[0]?.aspect).toBe('pacing');
    expect(e.similarLiked).toEqual([{ bookId: 2, title: 'The Song of Achilles', stars: 5 }]);
    expect(e.favoriteAuthor).toBe('Madeline Miller');
    expect(e.snippet).toEqual({ text: 'The prose is gorgeous.', aspect: 'writing_style' });
    expect(e.sources).toEqual(['cf', 'semantic']);
    expect(e.rankedBy).toBe('ranker');
  });

  it('never throws on missing or malformed evidence (the dicts are untyped JSON)', () => {
    const bad = {
      book: {},
      user_evidence: { top_positive_aspects: 'oops', similar_liked_items: [{ title: 3 }] },
      item_evidence: { pos_rates: { plot: 'high' }, snippet: null },
      signals: { sources: [1, 'cf'] },
    } as unknown as Evidence;
    const e = parseEvidence(bad);
    expect(e.positives).toEqual([]);
    expect(e.similarLiked).toEqual([]);
    expect(e.posRates).toEqual({});
    expect(e.snippet).toBeNull();
    expect(e.sources).toEqual(['cf']);
    expect(parseEvidence(null).sources).toEqual([]);
  });
});

describe('topAspects', () => {
  it('weights praise by how often the aspect comes up', () => {
    const rows = topAspects(parseEvidence(evidence), 2);
    // ending is praised most (95%) but almost never mentioned, so characters ranks first
    expect(rows.map((r) => r.key)).toEqual(['characters', 'plot']);
    expect(rows[0]).toMatchObject({ label: 'characters', value: 90 });
  });
});
