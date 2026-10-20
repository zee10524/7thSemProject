import { describe, expect, it } from 'vitest';
import { UserModel } from '../src/models/index.js';
import { BOOK, signUp, useTestApp } from './helpers.js';

const t = useTestApp();

const feedIds = async (s: Awaited<ReturnType<typeof signUp>>, query = '') =>
  (
    (await s.get(`/recommendations?k=50${query}`).expect(200)).body.items as { book: { bookId: number } }[]
  ).map((i) => i.book.bookId);

describe('library and the feed', () => {
  it('a rating bumps the profile version, marks the book read and leaves the feed', async () => {
    const s = await signUp(t.app);
    expect(await feedIds(s)).toContain(BOOK.projectHailMary);
    const res = await s.put(`/me/ratings/${BOOK.projectHailMary}`, { stars: 4.5 }).expect(200);
    expect(res.body).toMatchObject({ stars: 4.5, profileVersion: 1 });
    expect(await feedIds(s)).not.toContain(BOOK.projectHailMary);
    const index = (await s.get('/me/library').expect(200)).body;
    expect(index.ratings[String(BOOK.projectHailMary)]).toBe(4.5);
    expect(index.statuses[String(BOOK.projectHailMary)].status).toBe('read');
  });

  it('validates stars and book ids', async () => {
    const s = await signUp(t.app);
    const bad = await s.put(`/me/ratings/${BOOK.circe}`, { stars: 4.3 }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    await s.put(`/me/ratings/${BOOK.circe}`, { stars: 6 }).expect(400);
    await s.put('/me/ratings/99999', { stars: 4 }).expect(404);
    await s.put('/me/ratings/abc', { stars: 4 }).expect(400);
  });

  it('replays a rating write with the same Idempotency-Key and refuses a different body', async () => {
    const s = await signUp(t.app);
    const key = 'rate-circe-0001';
    const a = await s.put(`/me/ratings/${BOOK.circe}`, { stars: 5 }).set('Idempotency-Key', key).expect(200);
    const b = await s.put(`/me/ratings/${BOOK.circe}`, { stars: 5 }).set('Idempotency-Key', key).expect(200);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(b.body).toEqual(a.body);
    const user = await UserModel.findById(s.userId).lean();
    expect(user?.profileVersion).toBe(1); // the replay did not run the write again
    const c = await s.put(`/me/ratings/${BOOK.circe}`, { stars: 3 }).set('Idempotency-Key', key).expect(409);
    expect(c.body.error.code).toBe('CONFLICT');
  });

  it('dismissed books leave the feed and come back when undismissed', async () => {
    const s = await signUp(t.app);
    await s.put(`/me/dismissed/${BOOK.klaraAndTheSun}`).expect(204);
    expect(await feedIds(s)).not.toContain(BOOK.klaraAndTheSun);
    const page = await s.get('/me/dismissed').expect(200);
    expect(page.body.items[0].book.bookId).toBe(BOOK.klaraAndTheSun);
    await s.del(`/me/dismissed/${BOOK.klaraAndTheSun}`).expect(204);
    expect(await feedIds(s)).toContain(BOOK.klaraAndTheSun);
  });

  it('applies feed filters and muted genres from settings', async () => {
    const s = await signUp(t.app);
    const res = await s.get('/recommendations?k=50&maxPages=300&genres=Literary%20Fiction').expect(200);
    for (const item of res.body.items) {
      expect(item.book.pages).toBeLessThanOrEqual(300);
      expect(item.book.genres).toContain('Literary Fiction');
    }
    await s.patch('/me/overrides', { mutedGenres: ['Fantasy'] }).expect(200);
    const muted = await s.get('/recommendations?k=50').expect(200);
    expect(
      muted.body.items.every((i: { book: { genres: string[] } }) => !i.book.genres.includes('Fantasy')),
    ).toBe(true);
  });

  it('pages the reading list with a cursor', async () => {
    const s = await signUp(t.app);
    for (const id of [1, 2, 3, 4, 5])
      await s.put(`/me/reading-list/${id}`, { status: 'want_to_read' }).expect(200);
    const p1 = await s.get('/me/reading-list?status=want_to_read&limit=2').expect(200);
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await s
      .get(`/me/reading-list?status=want_to_read&limit=2&cursor=${p1.body.nextCursor}`)
      .expect(200);
    const p3 = await s
      .get(`/me/reading-list?status=want_to_read&limit=2&cursor=${p2.body.nextCursor}`)
      .expect(200);
    const all = [...p1.body.items, ...p2.body.items, ...p3.body.items].map(
      (i: { book: { bookId: number } }) => i.book.bookId,
    );
    expect(new Set(all).size).toBe(5);
    expect(p3.body.nextCursor).toBeNull();
    await s.get('/me/reading-list?cursor=garbage').expect(400);
  });

  it('tracks progress and stats', async () => {
    const s = await signUp(t.app);
    await s.put(`/me/reading-list/${BOOK.circe}`, { status: 'currently_reading', progress: 40 }).expect(200);
    await s.put(`/me/ratings/${BOOK.projectHailMary}`, { stars: 5 }).expect(200);
    const stats = (await s.get('/me/stats').expect(200)).body;
    expect(stats).toMatchObject({ read: 1, reading: 1, rated: 1, pagesRead: 476, avgStars: 5 });
    const recent = (await s.get('/me/recent-reads').expect(200)).body;
    expect(recent[0].book.bookId).toBe(BOOK.projectHailMary);
  });

  it('keeps one reader away from another reader data', async () => {
    const a = await signUp(t.app);
    const b = await signUp(t.app);
    await a.put(`/me/ratings/${BOOK.circe}`, { stars: 5 }).expect(200);
    const bIndex = (await b.get('/me/library').expect(200)).body;
    expect(bIndex.ratings).toEqual({});
  });

  it('series guard: rating volume one surfaces volume two in continue series only', async () => {
    const s = await signUp(t.app);
    await s.put(`/me/ratings/${BOOK.fellowship}`, { stars: 5 }).expect(200);
    const res = await s.get('/recommendations?k=50').expect(200);
    const ids = res.body.items.map((i: { book: { bookId: number } }) => i.book.bookId);
    expect(ids).not.toContain(BOOK.returnOfTheKing);
    expect(res.body.continueSeries.map((i: { book: { bookId: number } }) => i.book.bookId)).toEqual([
      BOOK.twoTowers,
    ]);
  });
});
