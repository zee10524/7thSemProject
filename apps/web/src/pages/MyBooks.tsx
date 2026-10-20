import type { CSSProperties, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { BookDto, ListEntryDto, ListStatus } from '@litsense/shared';
import {
  useDismissed,
  useLibrary,
  useRate,
  useRatings,
  useReadingList,
  useSetStatus,
  useStats,
  useUndismiss,
} from '../api/hooks';
import {
  Bar,
  Cover,
  Empty,
  ErrorState,
  PageHead,
  RateWidget,
  SkeletonCards,
  Spinner,
} from '../components/atoms';
import { bookHref } from '../lib/links';
import { useShelf } from '../lib/shelfState';
import { Icon } from '../components/Icon';
import { ShelfControl, StatusPill } from '../components/shelf';
import { ago } from '../lib/format';
import { toast, useUi, usePrefs } from '../store/ui';

const TABS = [
  { id: 'reading', label: 'Currently Reading', status: 'currently_reading' as ListStatus },
  { id: 'want', label: 'Want to Read', status: 'want_to_read' as ListStatus },
  { id: 'read', label: 'Read', status: 'read' as ListStatus },
  { id: 'dropped', label: 'Did not finish', status: 'dropped' as ListStatus },
  { id: 'ratings', label: 'Ratings' },
  { id: 'dismissed', label: 'Not for me' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const EMPTY: Record<TabId, [string, string]> = {
  reading: [
    'Nothing in progress',
    'Start a book from your Want to Read list and it shows up here with its progress.',
  ],
  want: ['Your list is empty', 'Add books from Discover or ask LitSense. They will wait here for you.'],
  read: ['No finished books yet', 'Mark a book as read and rate it. LitSense starts learning from it.'],
  dropped: ['Nothing abandoned', 'Books you stop reading land here, so we know what did not work.'],
  ratings: ['No ratings yet', 'Rate the books you have read; every rating sharpens your picks.'],
  dismissed: ['Nothing dismissed', 'Say "Not for me" on any pick and it never comes back. Undo it here.'],
};

function Shell({ book, i, children }: { book: BookDto; i: number; children: ReactNode }) {
  return (
    <article className="book" style={{ '--i': i } as CSSProperties}>
      <Link className="book__cover" to={bookHref(book)} aria-label={`Open ${book.title}`}>
        <Cover book={book} size="md" />
      </Link>
      <div className="book__body">
        <div className="book__top">
          <h3 className="book__title">
            <Link to={bookHref(book)}>{book.title}</Link>
          </h3>
          <p className="book__author">{book.author}</p>
        </div>
        {children}
      </div>
    </article>
  );
}

function ListCard({ entry, i }: { entry: ListEntryDto; i: number }) {
  const b = entry.book;
  const setStatus = useSetStatus();
  const rate = useRate();
  const openReview = useUi((s) => s.openReview);
  const { stars, reviewed } = useShelf(b.bookId);
  const progress = entry.progress ?? 0;

  if (entry.status === 'currently_reading') {
    return (
      <Shell book={b} i={i}>
        <div className="book__status">
          <StatusPill status="currently_reading" />
          <span className="book__when">Updated {ago(entry.updatedAt)}</span>
        </div>
        <div className="progress">
          <Bar value={progress} className="bar--progress" />
          <span className="progress__val">{progress}%</span>
        </div>
        <div className="book__actions">
          {progress < 100 ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate({
                  bookId: b.bookId,
                  status: 'currently_reading',
                  progress: Math.min(100, progress + 10),
                })
              }
            >
              <Icon name="book-open" size={15} stroke={2} />
              <span>Read 10% more</span>
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              setStatus.mutate(
                { bookId: b.bookId, status: 'read' },
                {
                  onSuccess: () =>
                    toast(`Finished ${b.title}. Rate it to sharpen your picks.`, {
                      action: { label: 'Review', run: () => openReview(b.bookId) },
                    }),
                },
              )
            }
          >
            <Icon name="check" size={15} stroke={2} />
            <span>Finished</span>
          </button>
          <ShelfControl book={b} short />
        </div>
      </Shell>
    );
  }
  if (entry.status === 'read') {
    return (
      <Shell book={b} i={i}>
        <div className="book__status">
          <StatusPill status="read" />
          <span className="book__when">Finished {ago(entry.updatedAt)}</span>
        </div>
        <div className="book__rating">
          <RateWidget
            value={stars}
            onRate={(v) => rate.mutate({ bookId: b.bookId, stars: v })}
            label={`Rate ${b.title}`}
          />
        </div>
        <div className="book__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => openReview(b.bookId)}>
            <Icon name="pen" size={15} stroke={2} />
            <span>{reviewed ? 'Edit review' : 'Add review'}</span>
          </button>
          <Link className="btn btn--ghost btn--sm" to={`/recent/${b.bookId}`}>
            <span>What next</span>
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
      </Shell>
    );
  }
  return (
    <Shell book={b} i={i}>
      <div className="book__status">
        <StatusPill status={entry.status} />
        <span className="book__when">Added {ago(entry.updatedAt)}</span>
      </div>
      {b.tagline && <p className="book__hook">{b.tagline}</p>}
      <div className="book__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ bookId: b.bookId, status: 'currently_reading', progress: 0 })}
        >
          <Icon name="book-open" size={15} stroke={2} />
          <span>{entry.status === 'dropped' ? 'Try again' : 'Start reading'}</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setStatus.mutate({ bookId: b.bookId, status: null })}
        >
          <Icon name="x" size={15} stroke={2} />
          <span>Remove</span>
        </button>
      </div>
    </Shell>
  );
}

function LoadMore({
  hasNext,
  fetching,
  onMore,
}: {
  hasNext: boolean;
  fetching: boolean;
  onMore: () => void;
}) {
  if (!hasNext) return null;
  return (
    <div className="load-more">
      <button type="button" className="btn btn--ghost" onClick={onMore} disabled={fetching}>
        {fetching ? <Spinner /> : 'Show more'}
      </button>
    </div>
  );
}

function ListTab({ status, tab, mode }: { status: ListStatus; tab: TabId; mode: string }) {
  const q = useReadingList(status);
  if (q.isPending) return <SkeletonCards count={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const entries = q.data.pages.flatMap((p) => p.items);
  if (!entries.length) return <TabEmpty tab={tab} />;
  return (
    <>
      <div className={`shelf shelf--${mode}`}>
        {entries.map((e, i) => (
          <ListCard key={e.book.bookId} entry={e} i={i} />
        ))}
      </div>
      <LoadMore
        hasNext={q.hasNextPage}
        fetching={q.isFetchingNextPage}
        onMore={() => void q.fetchNextPage()}
      />
    </>
  );
}

function RatingsTab({ mode }: { mode: string }) {
  const q = useRatings();
  const rate = useRate();
  if (q.isPending) return <SkeletonCards count={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const rows = q.data.pages.flatMap((p) => p.items);
  if (!rows.length) return <TabEmpty tab="ratings" />;
  return (
    <>
      <div className={`shelf shelf--${mode}`}>
        {rows.map((r, i) => (
          <Shell key={r.book.bookId} book={r.book} i={i}>
            <div className="book__status">
              <span className="book__when">Rated {ago(r.ratedAt)}</span>
            </div>
            <div className="book__rating">
              <RateWidget
                value={r.stars}
                onRate={(v) => rate.mutate({ bookId: r.book.bookId, stars: v })}
                label={`Rate ${r.book.title}`}
              />
            </div>
            <div className="book__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => rate.mutate({ bookId: r.book.bookId, stars: null })}
              >
                <Icon name="x" size={15} stroke={2} />
                <span>Clear rating</span>
              </button>
            </div>
          </Shell>
        ))}
      </div>
      <LoadMore
        hasNext={q.hasNextPage}
        fetching={q.isFetchingNextPage}
        onMore={() => void q.fetchNextPage()}
      />
    </>
  );
}

function DismissedTab({ mode }: { mode: string }) {
  const q = useDismissed();
  const undo = useUndismiss();
  if (q.isPending) return <SkeletonCards count={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const rows = q.data.pages.flatMap((p) => p.items);
  if (!rows.length) return <TabEmpty tab="dismissed" />;
  return (
    <>
      <div className={`shelf shelf--${mode}`}>
        {rows.map((r, i) => (
          <Shell key={r.book.bookId} book={r.book} i={i}>
            <div className="book__status">
              <span className="book__when">Hidden {ago(r.dismissedAt)}</span>
            </div>
            <div className="book__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={undo.isPending}
                onClick={() =>
                  undo.mutate(r.book.bookId, {
                    onSuccess: () => toast(`${r.book.title} can be recommended again`),
                  })
                }
              >
                <Icon name="refresh" size={15} />
                <span>Show it again</span>
              </button>
            </div>
          </Shell>
        ))}
      </div>
      <LoadMore
        hasNext={q.hasNextPage}
        fetching={q.isFetchingNextPage}
        onMore={() => void q.fetchNextPage()}
      />
    </>
  );
}

function TabEmpty({ tab }: { tab: TabId }) {
  const [title, text] = EMPTY[tab];
  return (
    <Empty
      title={title}
      action={
        <Link className="btn btn--primary btn--sm" to="/discover">
          <span>Browse Discover</span>
          <Icon name="arrow-right" size={15} />
        </Link>
      }
    >
      {text}
    </Empty>
  );
}

export default function MyBooksPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'reading') as TabId;
  const lib = useLibrary();
  const stats = useStats();
  const mode = usePrefs((s) => s.shelfView);
  const setMode = usePrefs((s) => s.setShelfView);

  const statuses = Object.values(lib.data?.statuses ?? {});
  const count = (id: TabId): number => {
    const t = TABS.find((x) => x.id === id);
    if (t && 'status' in t) return statuses.filter((s) => s.status === t.status).length;
    if (id === 'ratings') return Object.keys(lib.data?.ratings ?? {}).length;
    return lib.data?.dismissed.length ?? 0;
  };
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="page page--books">
      <PageHead
        eyebrow="Your shelves"
        title="My Reading Life"
        sub="Everything you are reading, planning to read and have finished. Rate and review as you go; LitSense listens."
      >
        <dl className="stats">
          {[
            ['Read', stats.data?.read],
            ['Reading', stats.data?.reading],
            ['Want to read', stats.data?.want],
            ['Pages read', stats.data?.pagesRead.toLocaleString('en-US')],
            ['Average rating', stats.data?.avgStars?.toFixed(1) ?? 'n/a'],
          ].map(([label, value]) => (
            <div key={label} className="stat">
              <dt className="stat__label">{label}</dt>
              <dd className="stat__value">{value ?? '·'}</dd>
            </div>
          ))}
        </dl>
      </PageHead>
      <section className="section section--shelf">
        <div className="container">
          <div className="tabs" role="tablist" aria-label="Shelves">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                className={`tab${t.id === tab ? ' is-active' : ''}`}
                onClick={() => setParams(t.id === 'reading' ? {} : { tab: t.id }, { replace: true })}
              >
                <span>{t.label}</span>
                <span className="tab__count">{count(t.id)}</span>
              </button>
            ))}
            <div className="tabs__tools seg" role="group" aria-label="View">
              <button
                type="button"
                className={`seg__btn${mode === 'grid' ? ' is-active' : ''}`}
                aria-pressed={mode === 'grid'}
                aria-label="Grid view"
                onClick={() => setMode('grid')}
              >
                <Icon name="grid" size={17} />
              </button>
              <button
                type="button"
                className={`seg__btn${mode === 'list' ? ' is-active' : ''}`}
                aria-pressed={mode === 'list'}
                aria-label="List view"
                onClick={() => setMode('list')}
              >
                <Icon name="list" size={17} />
              </button>
            </div>
          </div>
          <div role="tabpanel" aria-label={active.label}>
            {'status' in active ? (
              <ListTab key={active.id} status={active.status} tab={active.id} mode={mode} />
            ) : tab === 'ratings' ? (
              <RatingsTab mode={mode} />
            ) : (
              <DismissedTab mode={mode} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
