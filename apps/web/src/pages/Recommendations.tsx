import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { FeedQuery, RecItemDto } from '@litsense/shared';
import { useFeed, useGenres, useStats } from '../api/hooks';
import {
  Empty,
  ErrorState,
  PageHead,
  Reveal,
  Section,
  SectionHead,
  SkeletonCards,
} from '../components/atoms';
import { CardGrid, FeatureRec, RecWide } from '../components/cards';
import { Icon } from '../components/Icon';

const LENGTHS = [
  { id: 'any', label: 'Any length' },
  { id: 'short', label: 'Short, under 300', q: { maxPages: 299 } },
  { id: 'medium', label: 'Medium', q: { minPages: 300, maxPages: 449 } },
  { id: 'long', label: 'Long, 450+', q: { minPages: 450 } },
] as const;

const ERAS = [
  { id: 'any', label: 'Any era' },
  { id: 'new', label: 'Since 2015', q: { minYear: 2015 } },
  { id: 'modern', label: '1980 to 2014', q: { minYear: 1980, maxYear: 2014 } },
  { id: 'classic', label: 'Before 1980', q: { maxYear: 1979 } },
] as const;

const SORTS = [
  { id: 'rank', label: 'Best match' },
  { id: 'short', label: 'Shortest first' },
  { id: 'new', label: 'Newest first' },
] as const;

const BUCKET_COPY: Record<string, string> = {
  cold: 'Still getting to know you: picks lean on what you described and what is popular.',
  warming: 'Learning fast: a few more ratings and the reasons get sharper.',
  blending: 'Your ratings now shape most of the ranking.',
  warm: 'Fully personalised from your reading history.',
};

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip${o.id === value ? ' is-active' : ''}`}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function RecommendationsPage() {
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre') ?? 'all';
  const length = params.get('length') ?? 'any';
  const era = params.get('era') ?? 'any';
  const sort = params.get('sort') ?? 'rank';
  const genres = useGenres();
  const stats = useStats();

  const query: FeedQuery = useMemo(
    () => ({
      k: 24,
      ...(genre !== 'all' ? { genres: genre } : {}),
      ...(LENGTHS.find((l) => l.id === length && 'q' in l) as { q?: object } | undefined)?.q,
      ...(ERAS.find((e) => e.id === era && 'q' in e) as { q?: object } | undefined)?.q,
    }),
    [genre, length, era],
  );
  const feed = useFeed(query);

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const dirty = genre !== 'all' || length !== 'any' || era !== 'any';

  const items = useMemo(() => {
    const list = [...(feed.data?.items ?? [])];
    if (sort === 'short') list.sort((a, b) => (a.book.pages ?? 9999) - (b.book.pages ?? 9999));
    if (sort === 'new') list.sort((a, b) => (b.book.year ?? 0) - (a.book.year ?? 0));
    return list;
  }, [feed.data, sort]);

  const genreOptions = [
    { id: 'all', label: 'All genres' },
    ...(genres.data?.genres.slice(0, 9).map((g) => ({ id: g.name, label: g.name })) ?? []),
  ];
  const [first, ...rest] = items;

  return (
    <div className="page page--recs">
      <PageHead
        eyebrow="Recommendations"
        title={
          <>
            Made for <em>your taste.</em>
          </>
        }
        sub="Every pick comes with the reasons behind it. Rate more books and the reasons get sharper."
      >
        <p className="page-meta">
          <span>{feed.data ? `${feed.data.items.length} picks` : 'Finding picks'}</span>
          {stats.data && (
            <>
              <i />
              <span>
                Learned from {stats.data.rated} ratings and {stats.data.read} finished books
              </span>
            </>
          )}
          {feed.data && (
            <>
              <i />
              <span>{BUCKET_COPY[feed.data.bucket]}</span>
            </>
          )}
        </p>
      </PageHead>

      <Reveal className="filters">
        <div className="container">
          <div className="filters__inner">
            <div className="filters__row">
              <span className="filters__label">Genre</span>
              <Chips
                label="Filter by genre"
                options={genreOptions}
                value={genre}
                onChange={(v) => set('genre', v, 'all')}
              />
            </div>
            <div className="filters__row">
              <span className="filters__label">Era</span>
              <Chips
                label="Filter by era"
                options={ERAS}
                value={era}
                onChange={(v) => set('era', v, 'any')}
              />
            </div>
            <div className="filters__row filters__row--split">
              <div className="filters__group">
                <span className="filters__label">Length</span>
                <Chips
                  label="Filter by length"
                  options={LENGTHS}
                  value={length}
                  onChange={(v) => set('length', v, 'any')}
                />
              </div>
              <div className="filters__group filters__group--end">
                <label className="select">
                  <span className="filters__label">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => set('sort', e.target.value, 'rank')}
                    aria-label="Sort recommendations"
                  >
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                {dirty && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setParams({}, { replace: true })}
                  >
                    <Icon name="x" size={15} stroke={2} />
                    <span>Clear filters</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {feed.data?.degraded && (
        <div className="container">
          <p className="notice" role="status">
            <Icon name="info" size={16} /> Ranked by the backup blend while the learned ranker is unavailable.
            Picks are still personal.
          </p>
        </div>
      )}

      {feed.isPending ? (
        <div className="container section">
          <SkeletonCards count={4} wide />
        </div>
      ) : feed.isError ? (
        <div className="container">
          <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
        </div>
      ) : !items.length ? (
        <div className="container section">
          <Empty
            icon="search"
            title="No picks match these filters"
            action={
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setParams({}, { replace: true })}
              >
                Clear filters
              </button>
            }
          >
            Try a wider genre, era or length. LitSense only shows books you have not read yet.
          </Empty>
        </div>
      ) : (
        <div className={feed.isPlaceholderData ? 'is-refreshing' : undefined}>
          <Section id="sec-rtop" cls="top">
            <SectionHead
              no="01"
              title="Top picks"
              sub="The strongest matches, diversified so they do not all feel the same."
            />
            {first && <FeatureRec item={first} rank="01" />}
            {rest.length > 0 && (
              <div className="cards cards--wide">
                {rest.map((it: RecItemDto, i) => (
                  <RecWide key={it.book.bookId} item={it} i={i} />
                ))}
              </div>
            )}
          </Section>
          {feed.data.continueSeries.length > 0 && (
            <Section id="sec-series" cls="series">
              <SectionHead
                no="02"
                title="Continue the series"
                sub="The next volume of a series you have read. Never a later one first."
              />
              <CardGrid items={feed.data.continueSeries} compact />
            </Section>
          )}
        </div>
      )}

      <Reveal className="section section--method">
        <div className="container">
          <div className="method">
            <div className="method__head">
              <p className="eyebrow">How a pick is made</p>
              <h2>
                Three signals, <em>one personal ranking.</em>
              </h2>
              <p>
                A learned ranker blends them over a couple of hundred candidates, then keeps the list varied.
              </p>
            </div>
            <div className="method__cards">
              {[
                ['01', 'Collaborative', 'LightGCN learns from shared reading patterns between readers.'],
                ['02', 'Semantic', 'Sentence embeddings learn meaning from descriptions and reviews.'],
                [
                  '03',
                  'Interpretable',
                  'Review mining scores what readers praise or criticise across 12 aspects.',
                ],
              ].map(([no, h, p]) => (
                <div key={no} className="method__card">
                  <span className="method__no">{no}</span>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
