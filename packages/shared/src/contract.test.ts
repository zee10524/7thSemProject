import { describe, expect, it } from 'vitest';
import { ChatReply, parseChipKey, removeChipFromSession, SessionState, UserState } from './contract.js';

const session = SessionState.parse({
  session_id: 's1',
  turn: 2,
  aspect_deltas: { humor: 0.5 },
  descriptor_deltas: { darkness: -0.6, pace: 0.6 },
  filters: { max_pages: 380, min_year: 2010, genres_include: ['Fantasy', 'Mystery'] },
  anchor_ids: [3, 9],
  anchor_authors: ['Andy Weir'],
  last_shown: [1, 2, 3],
});

describe('chip keys (contract section 4)', () => {
  it('parses every documented key format', () => {
    expect(parseChipKey('anchor:book:12')).toEqual({ kind: 'anchor_book', bookId: 12 });
    expect(parseChipKey('anchor:author')).toEqual({ kind: 'anchor_author' });
    expect(parseChipKey('descriptor:darkness')).toEqual({ kind: 'descriptor', name: 'darkness' });
    expect(parseChipKey('aspect:humor')).toEqual({ kind: 'aspect', name: 'humor' });
    expect(parseChipKey('filter:max_pages')).toEqual({ kind: 'filter', field: 'max_pages' });
    expect(parseChipKey('filter:genres_include:Science Fiction')).toEqual({
      kind: 'filter_genre',
      field: 'genres_include',
      genre: 'Science Fiction',
    });
  });

  it('rejects unknown or malformed keys', () => {
    expect(parseChipKey('anchor:book:-1')).toBeNull();
    expect(parseChipKey('filter:password')).toBeNull();
    expect(parseChipKey('nonsense')).toBeNull();
  });

  it('removes only the named modifier and leaves the input untouched', () => {
    const next = removeChipFromSession(session, 'descriptor:darkness');
    expect(next.descriptor_deltas).toEqual({ pace: 0.6 });
    expect(session.descriptor_deltas).toEqual({ darkness: -0.6, pace: 0.6 });

    expect(removeChipFromSession(session, 'anchor:book:9').anchor_ids).toEqual([3]);
    expect(removeChipFromSession(session, 'anchor:author').anchor_authors).toEqual([]);
    expect(removeChipFromSession(session, 'aspect:humor').aspect_deltas).toEqual({});
    expect(removeChipFromSession(session, 'filter:max_pages').filters.max_pages).toBeNull();
    expect(removeChipFromSession(session, 'filter:genres_include:Fantasy').filters.genres_include).toEqual([
      'Mystery',
    ]);
  });

  it('throws on an unknown key', () => {
    expect(() => removeChipFromSession(session, 'bogus:key')).toThrow(/Unknown chip key/);
  });
});

describe('schema rules (contract section 3)', () => {
  it('rejects timestamps in seconds and stars outside 1 to 5', () => {
    const base = { book_id: 1, stars: 4 };
    expect(UserState.safeParse({ ratings: [{ ...base, ts: 1_700_000_000 }] }).success).toBe(false);
    expect(UserState.safeParse({ ratings: [{ ...base, ts: 1_700_000_000_000 }] }).success).toBe(true);
    expect(UserState.safeParse({ ratings: [{ book_id: 1, stars: 6, ts: 1_700_000_000_000 }] }).success).toBe(
      false,
    );
  });

  it('caps viewed at 50 entries', () => {
    expect(UserState.safeParse({ viewed: Array.from({ length: 51 }, (_, i) => i) }).success).toBe(false);
  });

  it('accepts an unknown intent so new core intents never break the app', () => {
    const reply = ChatReply.parse({
      intro: 'x',
      session: { session_id: 'a' },
      method: 'template',
      intent: 'brand_new_intent',
    });
    expect(reply.intent).toBe('brand_new_intent');
    expect(reply.items).toEqual([]);
  });
});
