import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ChatSessionModel, ReviewAnalysisModel, UserModel } from '../src/models/index.js';
import { API, BOOK, signUp, useTestApp } from './helpers.js';

const t = useTestApp();

describe('onboarding', () => {
  it('serves the cover grid, saves picks and text, and never recommends picks back', async () => {
    const s = await signUp(t.app);
    const grid = await s.get('/onboarding/grid').expect(200);
    expect(grid.body.books.length).toBeGreaterThan(20);
    expect(await s.get('/me/onboarding').expect(200)).toHaveProperty('body', null);

    const saved = await s
      .put('/me/onboarding', {
        picks: [BOOK.circe, BOOK.songOfAchilles],
        text: 'I love fantasy with great characters, nothing dark.',
      })
      .expect(200);
    expect(saved.body.picks.map((b: { bookId: number }) => b.bookId)).toEqual([
      BOOK.circe,
      BOOK.songOfAchilles,
    ]);
    expect(saved.body.displayChips).toEqual(expect.arrayContaining(['Likes: Fantasy', 'Values: characters']));
    expect((await s.get('/me').expect(200)).body.onboarded).toBe(true);

    const rails = (await s.get('/recommendations/rails').expect(200)).body;
    expect(rails.topPicks.length).toBeGreaterThan(0);
    expect(rails.becauseYouLiked[0].anchor.bookId).toBe(BOOK.circe);
    const ids = rails.topPicks.map((i: { book: { bookId: number } }) => i.book.bookId);
    expect(ids).not.toContain(BOOK.circe);
    expect(ids).not.toContain(BOOK.songOfAchilles);
  });

  it('lets the reader correct what was understood', async () => {
    const s = await signUp(t.app);
    const saved = await s.put('/me/onboarding', { picks: [], text: 'fantasy and romance' }).expect(200);
    const profile = { ...saved.body.profile, liked_genres: ['Fantasy'] };
    const fixed = await s.patch('/me/onboarding/profile', { profile }).expect(200);
    expect(fixed.body.displayChips).toEqual(['Likes: Fantasy']);
  });

  it('refuses an empty onboarding and unknown picks', async () => {
    const s = await signUp(t.app);
    await s.put('/me/onboarding', { picks: [], text: '' }).expect(400);
    await s.put('/me/onboarding', { picks: [12345] }).expect(400);
  });
});

describe('books, search and explanations', () => {
  it('serves a book with insights, similar books and more by the author', async () => {
    const book = await request(t.app).get(`${API}/books/${BOOK.projectHailMary}`).expect(200);
    expect(book.body).toMatchObject({ title: 'Project Hail Mary', author: 'Andy Weir', avgRating: 4.8 });
    const insights = await request(t.app).get(`${API}/books/${BOOK.projectHailMary}/insights`).expect(200);
    expect(insights.body.aspectBars).toHaveLength(12);
    const more = await request(t.app).get(`${API}/books/${BOOK.projectHailMary}/more-by-author`).expect(200);
    expect(more.body.map((i: { book: { title: string } }) => i.book.title)).toEqual(['The Martian']);
    const similar = await request(t.app).get(`${API}/books/${BOOK.projectHailMary}/similar?k=4`).expect(200);
    expect(similar.body).toHaveLength(4);
    await request(t.app).get(`${API}/books/4040`).expect(404);
  });

  it('personalises similar books for a signed-in reader (hides what they rated)', async () => {
    const s = await signUp(t.app);
    await s.put(`/me/ratings/${BOOK.theMartian}`, { stars: 5 }).expect(200);
    const res = await s.get(`/books/${BOOK.projectHailMary}/similar?k=10`).expect(200);
    expect(res.body.map((i: { book: { bookId: number } }) => i.book.bookId)).not.toContain(BOOK.theMartian);
  });

  it('searches titles, authors and meaning', async () => {
    const byAuthor = await request(t.app).get(`${API}/search?q=Andy%20Weir`).expect(200);
    expect(byAuthor.body.entity).toMatchObject({ kind: 'author', author: 'Andy Weir' });
    expect(byAuthor.body.hits[0].matched).toBe('author');
    const byMeaning = await request(t.app).get(`${API}/search?q=astronaut%20friendship`).expect(200);
    expect(byMeaning.body.hits.map((h: { book: { bookId: number } }) => h.book.bookId)).toContain(
      BOOK.projectHailMary,
    );
    await request(t.app).get(`${API}/search?q=`).expect(400);
  });

  it('explains a pick and caches it per profile version', async () => {
    const s = await signUp(t.app);
    const a = await s.get(`/recommendations/${BOOK.circe}/explanation`).expect(200);
    expect(a.body).toMatchObject({ bookId: BOOK.circe, method: 'template' });
    expect(a.body.text.length).toBeGreaterThan(10);
    const b = await s.get(`/recommendations/${BOOK.circe}/explanation`).expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('lists genres and pages the catalogue', async () => {
    const genres = await request(t.app).get(`${API}/books/genres`).expect(200);
    expect(genres.body.genres.find((g: { name: string }) => g.name === 'Fantasy').count).toBeGreaterThan(3);
    const p1 = await request(t.app).get(`${API}/books?limit=20`).expect(200);
    const p2 = await request(t.app).get(`${API}/books?limit=30&cursor=${p1.body.nextCursor}`).expect(200);
    expect(p1.body.items.length + p2.body.items.length).toBe(43);
  });
});

describe('chat', () => {
  it('runs a conversation: anchor + modifier, chip removal, explanation, clarification', async () => {
    const s = await signUp(t.app);
    const created = await s.post('/chat/sessions').expect(201);
    const id = created.body.id as string;

    const t1 = await s
      .post(`/chat/sessions/${id}/messages`, { message: 'Something like Project Hail Mary, but shorter' })
      .expect(200);
    expect(t1.body.reply.items.length).toBeGreaterThan(0);
    expect(t1.body.reply.items[0].book.title).toBeTruthy();
    const keys = t1.body.session.chips.map((c: { key: string }) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['anchor:book:0', 'filter:max_pages']));
    expect(t1.body.session.title).toBe('Something like Project Hail Mary, but shorter');

    const t2 = await s
      .del(`/chat/sessions/${id}/chips/${encodeURIComponent('filter:max_pages')}`)
      .expect(200);
    expect(t2.body.session.chips.map((c: { key: string }) => c.key)).not.toContain('filter:max_pages');

    const t3 = await s.post(`/chat/sessions/${id}/messages`, { message: 'why the second one?' }).expect(200);
    expect(t3.body.reply.intent).toBe('explain_recommendation');
    expect(t3.body.reply.items).toHaveLength(1);

    const t4 = await s
      .post(`/chat/sessions/${id}/messages`, { message: 'something like people' })
      .expect(200);
    expect(t4.body.reply.clarification.options.map((o: { label: string }) => o.label)).toEqual([
      'Anxious People',
      'Normal People',
    ]);

    const full = await s.get(`/chat/sessions/${id}`).expect(200);
    expect(full.body.turns.filter((x: { role: string }) => x.role === 'user')).toHaveLength(3);
    const stored = await ChatSessionModel.findById(id).lean();
    expect((stored?.state as { session_id: string }).session_id).toBeTruthy();

    const list = await s.get('/chat/sessions').expect(200);
    expect(list.body.items[0]).toMatchObject({ id, turnCount: 7 });
  });

  it('keeps conversations private and validates input', async () => {
    const a = await signUp(t.app);
    const b = await signUp(t.app);
    const { body } = await a.post('/chat/sessions').expect(201);
    await b.get(`/chat/sessions/${body.id}`).expect(404);
    await b.post(`/chat/sessions/${body.id}/messages`, { message: 'hi' }).expect(404);
    await a.post(`/chat/sessions/${body.id}/messages`, { message: '' }).expect(400);
    await a.get('/chat/sessions/not-an-id').expect(400);
    await a.del(`/chat/sessions/${body.id}/chips/bogus`).expect(400);
  });
});

describe('reviews and the background job', () => {
  it('stores the review, analyses it inline (no Redis) and bumps the profile version', async () => {
    const s = await signUp(t.app);
    const res = await s
      .put('/me/reviews', {
        bookId: BOOK.circe,
        stars: 5,
        text: 'Wonderful characters and gorgeous prose, but the middle dragged.',
      })
      .expect(200);
    expect(res.body.analysis.status).toBe('pending');
    await t.c.jobs.drain();

    const review = await s.get(`/me/reviews/${BOOK.circe}`).expect(200);
    expect(review.body.analysis.status).toBe('done');
    expect(review.body.analysis.aspects.characters).toBeGreaterThan(0);
    expect(review.body.analysis.aspects.pacing).toBeLessThan(0);
    const user = await UserModel.findById(s.userId).lean();
    expect(user?.profileVersion).toBeGreaterThanOrEqual(2); // rating + analysis

    const state = await t.c.states.build(s.userId);
    expect(state.review_analyses[0]).toMatchObject({ book_id: BOOK.circe });
    expect(state.review_analyses[0]?.ts).toBeGreaterThan(1e12);

    const taste = await s.get('/me/taste').expect(200);
    expect(taste.body.reviews).toBe(1);
    expect(taste.body.aspects.map((a: { aspect: string }) => a.aspect)).toContain('characters');
  });

  it('drops the stale analysis when the review is edited before the job runs', async () => {
    const s = await signUp(t.app);
    await s
      .put('/me/reviews', { bookId: BOOK.klaraAndTheSun, text: 'Boring and flat characters.' })
      .expect(200);
    await s
      .put('/me/reviews', { bookId: BOOK.klaraAndTheSun, text: 'Actually a wonderful, moving ending.' })
      .expect(200);
    await t.c.jobs.drain();
    const rows = await ReviewAnalysisModel.find({ userId: s.userId }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('done');
    expect((rows[0]?.aspects as Record<string, number>).ending).toBeGreaterThan(0);
  });

  it('deletes a review and its analysis', async () => {
    const s = await signUp(t.app);
    await s.put('/me/reviews', { bookId: BOOK.circe, text: 'Loved the writing.' }).expect(200);
    await t.c.jobs.drain();
    await s.del(`/me/reviews/${BOOK.circe}`).expect(204);
    await s.get(`/me/reviews/${BOOK.circe}`).expect(404);
    expect(await ReviewAnalysisModel.countDocuments({ userId: s.userId })).toBe(0);
  });
});

describe('platform', () => {
  it('serves health, readiness, OpenAPI and docs', async () => {
    await request(t.app).get('/healthz').expect(200);
    const ready = await request(t.app).get('/readyz').expect(200);
    expect(ready.body.status).toBe('ready');
    const spec = await request(t.app).get('/openapi.json').expect(200);
    expect(spec.body.openapi).toBe('3.1.0');
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining(['/api/v1/recommendations', '/api/v1/chat/sessions/{sessionId}/messages']),
    );
    await request(t.app).get('/docs/').expect(200);
  });

  it('returns the error envelope for unknown routes and bad JSON, with the request id echoed', async () => {
    const res = await request(t.app).get(`${API}/nope`).set('X-Request-Id', 'trace-abc-123').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: 'trace-abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
    const s = await signUp(t.app);
    const bad = await s.agent
      .put(`${API}/me/ratings/1`)
      .set('X-CSRF-Token', s.csrf)
      .set('Content-Type', 'application/json')
      .send('{"stars": ')
      .expect(400);
    expect(bad.body.error.code).toBe('BAD_REQUEST');
  });
});
