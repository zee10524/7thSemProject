import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { OnboardingProfile } from '@litsense/shared';
import {
  useOnboarding,
  useOnboardingGrid,
  usePatchOnboardingProfile,
  useSaveOnboarding,
  useSkipOnboarding,
} from '../api/hooks';
import { errorMessage } from '../api/http';
import { Cover, ErrorState, Spinner } from '../components/atoms';
import { Icon } from '../components/Icon';
import { aspectLabel } from '../lib/evidence';

const EXAMPLES = [
  'I love slow-burn fantasy with morally grey characters and found family.',
  'Cozy mysteries that are funny and not gory.',
  'Literary fiction with beautiful prose. Nothing too dark.',
  'Fast-paced science fiction with clever problem solving.',
];

const DESCRIPTOR_WORDS: Record<string, [string, string]> = {
  darkness: ['cozy', 'dark'],
  pace: ['slow-paced', 'fast-paced'],
  complexity_level: ['easy reads', 'dense reads'],
};

type ChipRef =
  | {
      field: 'liked_genres' | 'disliked_genres' | 'positive_aspects' | 'negative_aspects' | 'themes';
      value: string;
    }
  | { field: 'descriptors'; value: string };

function chipsOf(p: OnboardingProfile): { ref: ChipRef; label: string }[] {
  return [
    ...p.liked_genres.map((g) => ({
      ref: { field: 'liked_genres' as const, value: g },
      label: `Likes: ${g}`,
    })),
    ...p.disliked_genres.map((g) => ({
      ref: { field: 'disliked_genres' as const, value: g },
      label: `Avoids: ${g}`,
    })),
    ...p.positive_aspects.map((a) => ({
      ref: { field: 'positive_aspects' as const, value: a },
      label: `Values: ${aspectLabel(a)}`,
    })),
    ...p.negative_aspects.map((a) => ({
      ref: { field: 'negative_aspects' as const, value: a },
      label: `Dislikes: ${aspectLabel(a)}`,
    })),
    ...Object.entries(p.descriptors).map(([d, v]) => ({
      ref: { field: 'descriptors' as const, value: d },
      label: `Prefers: ${DESCRIPTOR_WORDS[d] ? (v > 0 ? DESCRIPTOR_WORDS[d][1] : DESCRIPTOR_WORDS[d][0]) : d}`,
    })),
    ...p.themes.map((t) => ({ ref: { field: 'themes' as const, value: t }, label: `Theme: ${t}` })),
  ];
}

function without(p: OnboardingProfile, ref: ChipRef): OnboardingProfile {
  const next: OnboardingProfile = JSON.parse(JSON.stringify(p));
  if (ref.field === 'descriptors') delete next.descriptors[ref.value];
  else next[ref.field] = next[ref.field].filter((x) => x !== ref.value);
  return next;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const grid = useOnboardingGrid();
  const existing = useOnboarding();
  const save = useSaveOnboarding();
  const patch = usePatchOnboardingProfile();
  const skip = useSkipOnboarding();
  const [picks, setPicks] = useState<number[] | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const chosen = picks ?? existing.data?.picks.map((b) => b.bookId) ?? [];
  const taste = text ?? existing.data?.text ?? '';
  const profile = save.data?.profile ?? (done ? existing.data?.profile : undefined);

  const toggle = (id: number) =>
    setPicks(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id].slice(0, 30));

  if (done && profile) {
    const chips = chipsOf(patch.data?.profile ?? profile);
    return (
      <div className="container onb">
        <p className="eyebrow">Step 3 of 3</p>
        <h1 className="page-title">
          Here is what we <em>heard.</em>
        </h1>
        <p className="page-sub">
          Remove anything that is not quite right. You can change it later in your account.
        </p>
        {chips.length ? (
          <ul className="brief onb__chips" aria-label="What LitSense understood">
            {chips.map((c) => (
              <li key={c.label} className="brief__tag">
                <span>{c.label}</span>
                <button
                  type="button"
                  className="brief__drop"
                  aria-label={`Remove ${c.label}`}
                  disabled={patch.isPending}
                  onClick={() => patch.mutate(without(patch.data?.profile ?? profile, c.ref))}
                >
                  <Icon name="x" size={13} stroke={2.4} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="aside__empty">Nothing specific yet: your picks will do the talking.</p>
        )}
        <div className="onb__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => navigate('/discover', { replace: true })}
          >
            <span>Show my front page</span>
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container onb">
      <div className="onb__head">
        <div>
          <p className="eyebrow">Welcome to LitSense</p>
          <h1 className="page-title">
            Tell us what you <em>love.</em>
          </h1>
          <p className="page-sub">
            Pick a few books you enjoyed and describe your taste in a sentence. Both are optional; together
            they work best.
          </p>
        </div>
        <button
          type="button"
          className="link-underline onb__skip"
          disabled={skip.isPending}
          onClick={() =>
            skip.mutate(undefined, { onSuccess: () => navigate('/discover', { replace: true }) })
          }
        >
          Skip for now
        </button>
      </div>

      <section className="onb__step" aria-labelledby="onb-picks">
        <h2 id="onb-picks" className="onb__label">
          <span className="shead__no">1</span> Books you enjoyed <small>{chosen.length} picked</small>
        </h2>
        {grid.isPending ? (
          <Spinner label="Loading books" />
        ) : grid.isError ? (
          <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />
        ) : (
          <ul className="onb__grid">
            {grid.data.books.map((b) => {
              const on = chosen.includes(b.bookId);
              return (
                <li key={b.bookId}>
                  <button
                    type="button"
                    className={`onb__pick${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    aria-label={`${b.title} by ${b.author}`}
                    onClick={() => toggle(b.bookId)}
                  >
                    <Cover book={b} size="sm" />
                    <span className="onb__check" aria-hidden="true">
                      <Icon name="check" size={16} stroke={2.6} />
                    </span>
                    <span className="onb__title">{b.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="onb__step" aria-labelledby="onb-text">
        <h2 id="onb-text" className="onb__label">
          <span className="shead__no">2</span> Your taste, in your words
        </h2>
        <label className="field">
          <span className="sr-only">Describe your reading taste</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={taste}
            placeholder="Slow-burn fantasy with morally grey characters. Not into grimdark."
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="chips onb__examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </section>

      {save.isError && (
        <p className="form-error" role="alert">
          {errorMessage(save.error)}
        </p>
      )}
      <div className="onb__actions">
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={save.isPending || (!chosen.length && !taste.trim())}
          onClick={() =>
            save.mutate({ picks: chosen, text: taste.trim() }, { onSuccess: () => setDone(true) })
          }
        >
          <span>{save.isPending ? 'Reading your taste' : 'Build my front page'}</span>
          <Icon name="arrow-right" size={18} />
        </button>
      </div>
    </div>
  );
}
