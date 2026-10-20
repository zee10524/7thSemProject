import { OnboardingProfile, UserState } from '@litsense/shared';
import { errors } from '../lib/errors.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type { BookCatalog } from './bookCatalog.js';

export const MAX_VIEWED = 50;

/**
 * Builds the contract `UserState` from the database for every model call (contract section 3).
 * Ids the catalogue no longer knows are dropped, so a stale row never makes the core reject a call.
 */
export class UserStateBuilder {
  constructor(private readonly catalog: BookCatalog) {}

  async build(userId: string): Promise<UserState> {
    const [user, ratings, list, dismissed, views, onboarding, analyses, known] = await Promise.all([
      userRepository.findById(userId),
      libraryRepository.allRatings(userId),
      libraryRepository.allListEntries(userId),
      libraryRepository.allDismissed(userId),
      libraryRepository.recentViews(userId, MAX_VIEWED),
      profileRepository.findOnboarding(userId),
      profileRepository.analysesForUser(userId, 'done'),
      this.catalog.knownIds(),
    ]);
    if (!user) throw errors.unauthenticated('Your account no longer exists.');
    const ok = (id: number) => known.has(id);

    const onboardingProfile = onboarding ? OnboardingProfile.safeParse(onboarding.profile) : null;

    return UserState.parse({
      // The core never needs our ids; user_id stays null so nothing identifying leaves the backend.
      user_id: null,
      corpus_user_id: null,
      ratings: ratings
        .filter((r) => ok(r.bookId))
        .map((r) => ({ book_id: r.bookId, stars: r.stars, ts: r.ratedAt.getTime() })),
      reading_list: list
        .filter((e) => ok(e.bookId))
        .map((e) => ({ book_id: e.bookId, status: e.status, ts: e.updatedAt.getTime() })),
      dismissed: dismissed.map((d) => d.bookId).filter(ok),
      viewed: views
        .map((v) => v.bookId)
        .filter(ok)
        .slice(0, MAX_VIEWED),
      onboarding: onboardingProfile?.success ? onboardingProfile.data : null,
      onboarding_picks: (onboarding?.picks ?? []).filter(ok),
      onboarding_text: onboarding?.text ? onboarding.text : null,
      review_analyses: analyses
        .filter((a) => ok(a.bookId))
        .map((a) => ({
          book_id: a.bookId,
          ts: a.ts,
          aspects: (a.aspects ?? {}) as Record<string, number>,
          spoiler_sentences: a.spoilerSentences ?? 0,
        })),
      overrides: {
        muted_genres: user.overrides?.mutedGenres ?? [],
        pinned_aspects: user.overrides?.pinnedAspects ?? [],
        disabled_ai: user.overrides?.disabledAi ?? false,
      },
      profile_version: user.profileVersion ?? 0,
    });
  }
}
