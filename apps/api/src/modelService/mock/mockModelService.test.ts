import { describe, expect, it } from 'vitest';
import { ChatReply, HomeRails, RecResponse, removeChipFromSession, UserState } from '@litsense/shared';
import { BOOKS } from './catalog.js';
import { MockModelService } from './mockModelService.js';

const m = new MockModelService();
const ctx = { requestId: 'test-req-1' };
const NOW = 1_760_000_000_000;
const PHM = 0;
const LOTR = [40, 41, 42] as const;

const state = (s: Partial<UserState> = {}) => UserState.parse(s);

describe('recommend (contract section 3 rules)', () => {
  it('returns schema-valid items and never recommends seen books', async () => {
    const s = state({
      ratings: [{ book_id: PHM, stars: 5, ts: NOW }],
      reading_list: [
        { book_id: 3, status: 'read', ts: NOW },
        { book_id: 4, status: 'dropped', ts: NOW },
        { book_id: 5, status: 'want_to_read', ts: NOW },
      ],
      dismissed: [6],
      onboarding_picks: [7],
    });
    const res = RecResponse.parse(await m.recommend(ctx, { state: s, k: 40 }));
    const ids = res.items.map((i) => i.book_id);
    for (const seen of [PHM, 3, 4, 6, 7]) expect(ids).not.toContain(seen);
    expect(ids).toContain(5); // want_to_read can still appear
    expect(res.items.every((i) => i.reason.length > 0)).toBe(true);
  });

  it('puts the reader in the right interaction bucket (n = ratings + 0.5 x list)', async () => {
    const ratings = [1, 2, 3, 4].map((b) => ({ book_id: b, stars: 4, ts: NOW }));
    const res = await m.recommend(ctx, {
      state: state({ ratings, reading_list: [{ book_id: 9, status: 'want_to_read', ts: NOW }] }),
      k: 5,
    });
    expect(res.bucket).toBe('warming'); // n = 4.5
  });

  it('applies filters and muted genres', async () => {
    const res = await m.recommend(ctx, {
      state: state({ overrides: { muted_genres: ['Fantasy'], pinned_aspects: [], disabled_ai: false } }),
      k: 50,
      filters: { max_pages: 350, min_year: 2000 },
    });
    for (const item of res.items) {
      const b = BOOKS[item.book_id]!;
      expect(b.pages).toBeLessThanOrEqual(350);
      expect(b.year).toBeGreaterThanOrEqual(2000);
      expect(b.genres).not.toContain('Fantasy');
    }
  });

  it('keeps later volumes out of the feed and puts the next one in continue_series', async () => {
    const before = await m.recommend(ctx, { state: state(), k: 50 });
    expect(before.items.map((i) => i.book_id)).not.toContain(LOTR[1]);
    expect(before.items.map((i) => i.book_id)).not.toContain(LOTR[2]);

    const after = await m.recommend(ctx, {
      state: state({ ratings: [{ book_id: LOTR[0], stars: 5, ts: NOW }] }),
      k: 50,
    });
    expect(after.items.map((i) => i.book_id)).not.toContain(LOTR[2]);
    expect(after.continue_series.map((i) => i.book_id)).toEqual([LOTR[1]]);
  });

  it('rejects unknown book ids as invalid input', async () => {
    await expect(m.recommend(ctx, { state: state({ dismissed: [9999] }), k: 5 })).rejects.toMatchObject({
      kind: 'rejected',
    });
  });

  it('a rating moves the feed (genre and author affinity)', async () => {
    const cold = await m.recommend(ctx, { state: state(), k: 5 });
    const warm = await m.recommend(ctx, {
      state: state({ ratings: [{ book_id: PHM, stars: 5, ts: NOW }] }),
      k: 5,
    });
    expect(warm.items.map((i) => i.book_id)).not.toEqual(cold.items.map((i) => i.book_id));
    expect(warm.items.map((i) => i.book_id)).toContain(12); // The Martian, same author
  });
});

describe('home_rails', () => {
  it('fills the rails the contract describes', async () => {
    const rails = HomeRails.parse(
      await m.homeRails(ctx, {
        state: state({
          ratings: [
            { book_id: PHM, stars: 5, ts: NOW },
            { book_id: 13, stars: 4, ts: NOW - 1000 },
          ],
          viewed: [18],
          reading_list: [{ book_id: 21, status: 'want_to_read', ts: NOW }],
        }),
      }),
    );
    expect(rails.top_picks.length).toBeGreaterThan(0);
    expect(rails.because_you_liked.map((b) => b.anchor_book_id)).toEqual([PHM, 13]);
    expect(rails.continue_exploring.length).toBeGreaterThan(0);
    expect(rails.from_reading_list.length).toBeGreaterThan(0);
    expect(rails.hidden_gems).toEqual([]); // n < 5
    expect(rails.more_by_authors.length).toBeGreaterThan(0); // Andy Weir and Madeline Miller have 2 books
  });
});

describe('chat_turn (contract section 4)', () => {
  const s = state({ ratings: [{ book_id: 13, stars: 5, ts: NOW }] });

  it('runs the three-turn demo: like X but shorter, more by that author, why the second one', async () => {
    const t1 = ChatReply.parse(
      await m.chatTurn(ctx, {
        state: s,
        session: null,
        message: 'something like Project Hail Mary but shorter',
      }),
    );
    expect(t1.intent).toBe('similar_to_with_modifier');
    expect(t1.items.length).toBeGreaterThan(0);
    for (const item of t1.items) expect(BOOKS[item.book_id]!.pages).toBeLessThanOrEqual(380);
    expect(t1.chips.map((c) => c.key)).toEqual(expect.arrayContaining(['anchor:book:0', 'filter:max_pages']));
    expect(t1.items.every((i) => !i.reason.includes(BOOKS[i.book_id]!.title))).toBe(true);

    const t2 = await m.chatTurn(ctx, { state: s, session: t1.session, message: 'more by that author' });
    expect(t2.intent).toBe('more_by_author');
    expect(t2.items.map((i) => BOOKS[i.book_id]!.author)).toEqual(expect.arrayContaining(['Andy Weir']));

    const t3 = await m.chatTurn(ctx, { state: s, session: t2.session, message: 'why the second one?' });
    expect(t3.intent).toBe('explain_recommendation');
    expect(t3.items).toHaveLength(1);
    expect(t3.session.last_shown).toEqual(t2.session.last_shown);
  });

  it('removing a chip and sending an empty message re-runs the session without it', async () => {
    const t1 = await m.chatTurn(ctx, { state: s, session: null, message: 'cozy and under 300 pages' });
    expect(t1.chips.map((c) => c.key)).toEqual(
      expect.arrayContaining(['descriptor:darkness', 'filter:max_pages']),
    );
    const without = removeChipFromSession(t1.session, 'filter:max_pages');
    const t2 = await m.chatTurn(ctx, { state: s, session: without, message: '' });
    expect(t2.chips.map((c) => c.key)).not.toContain('filter:max_pages');
    expect(t2.chips.map((c) => c.key)).toContain('descriptor:darkness');
  });

  it('asks for clarification when a name matches several books, with empty items', async () => {
    const r = await m.chatTurn(ctx, { state: s, session: null, message: 'something like people' });
    expect(r.items).toEqual([]);
    expect(r.clarification?.options.map((o) => o.label)).toEqual(['Anxious People', 'Normal People']);
    const picked = await m.chatTurn(ctx, {
      state: s,
      session: r.session,
      message: String(r.clarification!.options[1]!.value),
    });
    expect(picked.intent).toBe('similar_to');
    expect(picked.session.anchor_ids).toEqual([38]);
  });

  it('declines out-of-scope messages without recommending', async () => {
    const r = await m.chatTurn(ctx, { state: s, session: null, message: 'what is the weather tomorrow' });
    expect(r.intent).toBe('out_of_scope');
    expect(r.items).toEqual([]);
  });

  it('keeps the last six messages, each cut to 300 characters', async () => {
    let session = null;
    for (let i = 0; i < 5; i += 1) {
      session = (
        await m.chatTurn(ctx, { state: s, session, message: `cozy fantasy ${'x'.repeat(400)} ${i}` })
      ).session;
    }
    expect(session!.history).toHaveLength(6);
    expect(session!.history.every((h) => h.text.length <= 300)).toBe(true);
  });
});

describe('other functions', () => {
  it('parse_onboarding reads genres, aspects, descriptors and negation', async () => {
    const r = await m.parseOnboarding(ctx, {
      text: 'I love fantasy with great characters. Not into thriller, and cozy please.',
      picks: [PHM],
    });
    expect(r.profile.liked_genres).toContain('Fantasy');
    expect(r.profile.disliked_genres).toContain('Thriller');
    expect(r.profile.positive_aspects).toContain('characters');
    expect(r.profile.descriptors.darkness).toBeLessThan(0);
    expect(r.resolved_picks).toEqual([PHM]);
    expect(r.method).toBe('embed_only');
    expect(r.display_chips.length).toBeGreaterThan(0);
  });

  it('book_insights returns twelve aspect bars and spoiler-safe snippets', async () => {
    const r = await m.bookInsights(ctx, { bookId: PHM });
    expect(r.aspect_bars).toHaveLength(12);
    expect(r.snippets.every((s) => !/turns out|the ending|dies/i.test(s.text))).toBe(true);
  });

  it('analyze_user_review finds aspect polarity per clause', async () => {
    const r = await m.analyzeUserReview(ctx, {
      text: 'Wonderful characters, but the middle third really dragged.',
    });
    expect(r.aspects.characters).toBeGreaterThan(0);
    expect(r.aspects.pacing).toBeLessThan(0);
  });

  it('semantic_search reports what matched', async () => {
    const hits = await m.semanticSearch(ctx, { query: 'andy weir', k: 5 });
    expect(hits[0]?.matched).toBe('author');
    const meaning = await m.semanticSearch(ctx, { query: 'astronaut friendship', k: 5 });
    expect(meaning.map((h) => h.book_id)).toContain(PHM);
  });

  it('catalog pages through every book', async () => {
    const first = await m.catalogPage(ctx, { cursor: null, limit: 30 });
    const second = await m.catalogPage(ctx, { cursor: first.next_cursor, limit: 30 });
    expect(first.items.length + second.items.length).toBe(BOOKS.length);
    expect(second.next_cursor).toBeNull();
  });
});
