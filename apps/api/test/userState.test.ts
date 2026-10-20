import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { UserState } from '@litsense/shared';
import {
  DismissalModel,
  OnboardingModel,
  RatingModel,
  ReadingListModel,
  ReviewAnalysisModel,
  UserModel,
  ViewModel,
} from '../src/models/index.js';
import { useTestApp } from './helpers.js';

const t = useTestApp();

async function makeUser() {
  const u = await UserModel.create({
    email: `state-${new Types.ObjectId().toHexString()}@litsense.test`,
    passwordHash: 'x',
    name: 'S',
    profileVersion: 7,
    overrides: { mutedGenres: ['Horror'], pinnedAspects: ['characters'], disabledAi: true },
  });
  return u._id;
}

describe('UserStateBuilder', () => {
  it('maps every stored signal to the contract UserState', async () => {
    const userId = await makeUser();
    const at = new Date('2026-10-01T10:00:00Z');
    await RatingModel.create({ userId, bookId: 0, stars: 4.5, ratedAt: at });
    await ReadingListModel.create({ userId, bookId: 1, status: 'want_to_read', updatedAt: at });
    await DismissalModel.create({ userId, bookId: 2, dismissedAt: at });
    await OnboardingModel.create({
      userId,
      picks: [3, 4],
      text: 'cozy fantasy',
      profile: { liked_genres: ['Fantasy'], descriptors: { darkness: -0.6 } },
      displayChips: ['Likes: Fantasy'],
      method: 'embed_only',
    });
    await ReviewAnalysisModel.create({
      userId,
      bookId: 0,
      reviewId: new Types.ObjectId(),
      revision: at.getTime(),
      status: 'done',
      aspects: { characters: 0.8 },
      spoilerSentences: 1,
      ts: at.getTime(),
    });
    await ReviewAnalysisModel.create({
      userId,
      bookId: 5,
      reviewId: new Types.ObjectId(),
      revision: 1,
      status: 'pending',
      ts: at.getTime(),
    });

    const state = await t.c.states.build(String(userId));
    expect(UserState.safeParse(state).success).toBe(true);
    expect(state.user_id).toBeNull();
    expect(state.ratings).toEqual([{ book_id: 0, stars: 4.5, ts: at.getTime() }]);
    expect(state.ratings[0]!.ts).toBeGreaterThan(1e11); // milliseconds, not seconds
    expect(state.reading_list).toEqual([{ book_id: 1, status: 'want_to_read', ts: at.getTime() }]);
    expect(state.dismissed).toEqual([2]);
    expect(state.onboarding_picks).toEqual([3, 4]);
    expect(state.onboarding_text).toBe('cozy fantasy');
    expect(state.onboarding?.liked_genres).toEqual(['Fantasy']);
    expect(state.onboarding?.positive_aspects).toEqual([]); // defaults filled by the schema
    expect(state.review_analyses).toEqual([
      { book_id: 0, ts: at.getTime(), aspects: { characters: 0.8 }, spoiler_sentences: 1 },
    ]);
    expect(state.overrides).toEqual({
      muted_genres: ['Horror'],
      pinned_aspects: ['characters'],
      disabled_ai: true,
    });
    expect(state.profile_version).toBe(7);
  });

  it('lists views newest first, at most 50', async () => {
    const userId = await makeUser();
    const base = Date.parse('2026-01-01T00:00:00Z');
    await ViewModel.insertMany(
      Array.from({ length: 43 }, (_, i) => ({ userId, bookId: i, viewedAt: new Date(base + i * 60_000) })),
    );
    const state = await t.c.states.build(String(userId));
    expect(state.viewed[0]).toBe(42);
    expect(state.viewed.at(-1)).toBe(0);
    expect(state.viewed.length).toBeLessThanOrEqual(50);
  });

  it('drops ids the catalogue no longer has, so the core never rejects the state', async () => {
    const userId = await makeUser();
    await RatingModel.create({ userId, bookId: 9999, stars: 5, ratedAt: new Date() });
    await DismissalModel.create({ userId, bookId: 8888, dismissedAt: new Date() });
    const state = await t.c.states.build(String(userId));
    expect(state.ratings).toEqual([]);
    expect(state.dismissed).toEqual([]);
  });
});
