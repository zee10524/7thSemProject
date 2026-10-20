import { ASPECT_LABELS, type BookDto, type OnboardingDto, type OnboardingProfile } from '@litsense/shared';
import type { Cached } from '../lib/cache.js';
import { errors } from '../lib/errors.js';
import type { CallContext, ModelService } from '../modelService/index.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import type { BookCatalog } from './bookCatalog.js';

const DESCRIPTOR_LABELS: Record<string, [string, string]> = {
  darkness: ['cozy', 'dark'],
  pace: ['slow-paced', 'fast-paced'],
  complexity_level: ['easy reads', 'dense reads'],
};

/** Read-back chips built from a profile the reader corrected (same wording as the core's chips). */
export function chipsFromProfile(p: OnboardingProfile): string[] {
  const label = (a: string) => (a in ASPECT_LABELS ? ASPECT_LABELS[a as keyof typeof ASPECT_LABELS] : a);
  return [
    ...p.liked_genres.map((g) => `Likes: ${g}`),
    ...p.disliked_genres.map((g) => `Avoids: ${g}`),
    ...p.positive_aspects.map((a) => `Values: ${label(a)}`),
    ...p.negative_aspects.map((a) => `Dislikes: ${label(a)}`),
    ...Object.entries(p.descriptors).map(([d, v]) => {
      const pair = DESCRIPTOR_LABELS[d];
      return `Prefers: ${pair ? (v > 0 ? pair[1] : pair[0]) : d}`;
    }),
    ...p.themes.map((t) => `Theme: ${t}`),
  ];
}

export class OnboardingService {
  constructor(
    private readonly model: ModelService,
    private readonly catalog: BookCatalog,
    private readonly cache: Cached,
  ) {}

  async grid(ctx: CallContext): Promise<BookDto[]> {
    const version = await this.catalog.version();
    const ids = await this.cache.wrap(`onboarding-grid:${version}:60`, 3600, () =>
      this.model.onboardingGrid(ctx, { n: 60 }),
    );
    const books = await this.catalog.getMany(ids);
    return ids.flatMap((id) => {
      const b = books.get(id);
      return b ? [b] : [];
    });
  }

  async get(userId: string): Promise<OnboardingDto | null> {
    const row = await profileRepository.findOnboarding(userId);
    return row ? this.toDto(row) : null;
  }

  async save(
    ctx: CallContext,
    userId: string,
    input: { picks: number[]; text: string },
  ): Promise<OnboardingDto> {
    const picks = [...new Set(input.picks)];
    if (!picks.length && !input.text)
      throw errors.badRequest('Pick a few books or describe what you like to read.');
    const known = await this.catalog.knownIds();
    const unknown = picks.filter((id) => !known.has(id));
    if (unknown.length) throw errors.badRequest('Some picked books are not in the catalogue.', { unknown });

    const parsed = await this.model.parseOnboarding(ctx, { text: input.text, picks });
    const row = await profileRepository.upsertOnboarding(userId, {
      picks: parsed.resolved_picks.filter((id) => known.has(id)),
      text: input.text,
      profile: parsed.profile,
      displayChips: parsed.display_chips,
      method: parsed.method,
    });
    await Promise.all([userRepository.markOnboarded(userId), userRepository.bumpProfileVersion(userId)]);
    return this.toDto(row);
  }

  /** The reader corrected what LitSense understood (removed a chip): store their version. */
  async updateProfile(userId: string, profile: OnboardingProfile): Promise<OnboardingDto> {
    const row = await profileRepository.updateOnboardingProfile(userId, profile, chipsFromProfile(profile));
    if (!row) throw errors.notFound('Onboarding profile');
    await userRepository.bumpProfileVersion(userId);
    return this.toDto(row);
  }

  async skip(userId: string): Promise<void> {
    await userRepository.markOnboarded(userId);
  }

  private async toDto(
    row: NonNullable<Awaited<ReturnType<typeof profileRepository.findOnboarding>>>,
  ): Promise<OnboardingDto> {
    const books = await this.catalog.getMany(row.picks ?? []);
    return {
      picks: (row.picks ?? []).flatMap((id) => {
        const b = books.get(id);
        return b ? [b] : [];
      }),
      text: row.text ?? '',
      profile: row.profile as OnboardingProfile,
      displayChips: row.displayChips ?? [],
      method: row.method,
      updatedAt: (row.updatedAt ?? new Date()).toISOString(),
    };
  }
}
