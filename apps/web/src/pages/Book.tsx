import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import {
  useBook,
  useExplanation,
  useInsights,
  useMe,
  useMoreByAuthor,
  useRate,
  useRecordView,
  useReview,
  useSimilar,
} from '../api/hooks';
import { errorMessage } from '../api/http';
import {
  AspectRow,
  Bar,
  Cover,
  Empty,
  ErrorState,
  RateWidget,
  Reveal,
  Spinner,
  Stars,
  Tag,
} from '../components/atoms';
import { MiniCard } from '../components/cards';
import { Icon } from '../components/Icon';
import { DismissButton, ShelfControl } from '../components/shelf';
import { useShelf } from '../lib/shelfState';
import { ASPECT_ROWS, aspectLabel, parseEvidence, sourceLabel } from '../lib/evidence';
import { fmtCount } from '../lib/format';
import { useUi } from '../store/ui';

function WhyPanel({ bookId, read }: { bookId: number; read: boolean }) {
  const exp = useExplanation(bookId, !read);
  const review = useReview(read ? bookId : null);
  const shelf = useShelf(bookId);

  if (read) {
    const loved = Object.entries(review.data?.analysis.aspects ?? {}).sort((a, b) => b[1] - a[1]);
    return (
      <Reveal className="why-panel">
        <div className="why-panel__head">
          <div>
            <p className="eyebrow">You read this</p>
            <h2>Why you loved it</h2>
          </div>
        </div>
        <p className="why-panel__headline">
          {shelf.stars ? `You gave this ${shelf.stars.toFixed(1)} stars. ` : 'You finished this. '}
          {loved.length
            ? 'Here is what LitSense heard in your review.'
            : 'Write a review and LitSense will learn what you valued.'}
        </p>
        {loved.length > 0 && (
          <ul className="evidence">
            {loved.map(([a, v]) => (
              <Tag key={a} kind={v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'neutral'}>
                {aspectLabel(a)}
              </Tag>
            ))}
          </ul>
        )}
      </Reveal>
    );
  }

  const ev = parseEvidence(exp.data?.evidence);
  return (
    <Reveal className="why-panel">
      <div className="why-panel__head">
        <div>
          <p className="eyebrow">Your match</p>
          <h2>Why LitSense thinks you&rsquo;ll love it</h2>
        </div>
        {exp.data && (
          <span className="method-badge">
            {exp.data.method === 'llm' ? 'written by AI, checked' : 'template'}
          </span>
        )}
      </div>
      {exp.isPending ? (
        <Spinner label="Writing the explanation" />
      ) : exp.isError ? (
        <p className="why-panel__headline">{errorMessage(exp.error)}</p>
      ) : (
        <>
          <p className="why-panel__headline">{exp.data.text}</p>
          <div className="why-panel__cols">
            <div>
              <span className="label">Why it matches</span>
              <ul className="plus-list">
                {ev.positives.map((p) => (
                  <li key={p.aspect} className="plus">
                    <span className="plus__icon">
                      <Icon name="plus" size={14} stroke={2.4} />
                    </span>
                    <span className="plus__text">Readers praise its {p.label}</span>
                    <b>{Math.round(p.strength * 100)}%</b>
                  </li>
                ))}
                {ev.similarLiked.map((s) => (
                  <li key={s.bookId} className="plus">
                    <span className="plus__icon">
                      <Icon name="plus" size={14} stroke={2.4} />
                    </span>
                    <span className="plus__text">
                      Close to <Link to={`/book/${s.bookId}`}>{s.title}</Link> ({s.stars} stars from you)
                    </span>
                  </li>
                ))}
                {!ev.positives.length && !ev.similarLiked.length && (
                  <li className="plus">A broad pick, chosen to widen your reading.</li>
                )}
              </ul>
              {ev.negatives.length > 0 && (
                <>
                  <span className="label label--neg">Potential mismatch</span>
                  <ul className="minus-list">
                    {ev.negatives.map((n) => (
                      <li key={n.aspect} className="minus">
                        <span className="minus__icon">
                          <Icon name="minus" size={14} stroke={2.4} />
                        </span>
                        <span className="minus__text">Its {n.label} may not suit you</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div>
              <span className="label">How LitSense decided</span>
              <ul className="drawer__sources">
                {ev.sources.map((s) => (
                  <li key={s}>{sourceLabel(s)}</li>
                ))}
                {ev.bucket && <li>Personalisation stage: {ev.bucket}</li>}
              </ul>
            </div>
          </div>
        </>
      )}
      <p className="spoiler-note">
        <Icon name="shield" size={14} />
        <span>Spoiler-safe. Built only from aspect scores and reader reviews, never from plot details.</span>
      </p>
    </Reveal>
  );
}

function BookDna({ bookId }: { bookId: number }) {
  const ins = useInsights(bookId);
  const me = useMe();
  const pinned = new Set(me.data?.overrides.pinnedAspects ?? []);
  if (ins.isPending) return <Spinner label="Reading the reviews" />;
  if (ins.isError) return <ErrorState error={ins.error} onRetry={() => void ins.refetch()} />;
  const bars = new Map(ins.data.aspectBars.map((b) => [b.aspect, b]));
  const rows = ASPECT_ROWS.filter((r) => bars.has(r.key));
  return (
    <>
      <Reveal className="dna">
        <div className="dna__head">
          <div>
            <p className="eyebrow">Book DNA</p>
            <h2>The 12 literary aspects</h2>
          </div>
          <ul className="legend">
            <li>
              <i className="legend__book" />
              Share of mentions that praise it
            </li>
            {pinned.size > 0 && (
              <li>
                <i className="legend__pref" />
                Pinned by you
              </li>
            )}
          </ul>
        </div>
        {rows.length ? (
          <div className="dna__grid">
            {rows.map((r) => {
              const b = bars.get(r.key)!;
              return (
                <AspectRow
                  key={r.key}
                  no={r.no}
                  label={r.label}
                  value={Math.round(b.pos_rate * 100)}
                  pref={pinned.has(r.key) ? 100 : null}
                  suffix="%"
                  className={b.mention_rate < 0.08 ? 'aspect--quiet' : undefined}
                />
              );
            })}
          </div>
        ) : (
          <p className="muted">Not enough reviews yet to describe this book&rsquo;s aspects.</p>
        )}
      </Reveal>
      <Reveal className="reviews">
        <div className="dna__head">
          <div>
            <p className="eyebrow">Readers say</p>
            <h2>What reviews reveal</h2>
          </div>
          {ins.data.nReviews > 0 && (
            <span className="muted">{fmtCount(ins.data.nReviews)} reviews analysed</span>
          )}
        </div>
        {ins.data.reviewSummary && <p className="review-summary">{ins.data.reviewSummary}</p>}
        <div className="reviews__list">
          {ins.data.snippets.length ? (
            ins.data.snippets.map((s) => (
              <article key={s.review_ref} className="review">
                <header className="review__head">
                  <span className="avatar" aria-hidden="true">
                    <Icon name="quote" size={16} />
                  </span>
                  <div>
                    <strong className="review__name">A reader on its {aspectLabel(s.aspect)}</strong>
                    <span className="review__overlap">{s.helpful_votes} found this helpful</span>
                  </div>
                </header>
                <p className="review__text">&ldquo;{s.text}&rdquo;</p>
              </article>
            ))
          ) : (
            <p className="muted">No spoiler-safe snippets yet.</p>
          )}
        </div>
      </Reveal>
    </>
  );
}

function Related({ bookId, author }: { bookId: number; author: string | null }) {
  const more = useMoreByAuthor(bookId);
  const similar = useSimilar(bookId, 8);
  return (
    <>
      {more.data && more.data.length > 0 && (
        <Reveal className="related">
          <h2>More by {author}</h2>
          <div className="strip strip--tight">
            {more.data.map((it, i) => (
              <MiniCard
                key={it.book.bookId}
                book={it.book}
                i={i}
                note={it.book.series?.pos ? `Book ${it.book.series.pos}` : undefined}
              />
            ))}
          </div>
        </Reveal>
      )}
      {similar.data && similar.data.length > 0 && (
        <Reveal className="related">
          <h2>Readers like you also read</h2>
          <div className="strip strip--tight">
            {similar.data.map((it, i) => (
              <MiniCard key={it.book.bookId} book={it.book} i={i} note={it.reason} />
            ))}
          </div>
        </Reveal>
      )}
    </>
  );
}

export default function BookPage() {
  const bookId = Number(useParams().bookId);
  const valid = Number.isInteger(bookId) && bookId >= 0;
  const book = useBook(valid ? bookId : -1);
  const shelf = useShelf(bookId);
  const rate = useRate();
  const view = useRecordView();
  const openReview = useUi((s) => s.openReview);
  const { mutate: recordView } = view;

  useEffect(() => {
    if (valid && book.data) recordView(bookId);
  }, [valid, bookId, book.data, recordView]);

  if (!valid || book.isError) {
    return (
      <div className="container">
        {book.isError && !(book.error && 'status' in book.error && book.error.status === 404) ? (
          <ErrorState error={book.error} onRetry={() => void book.refetch()} />
        ) : (
          <Empty
            icon="search"
            title="We could not find that book"
            action={
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => useUi.getState().setSearchOpen(true)}
              >
                Search books
              </button>
            }
          >
            It may have moved. Try searching for it.
          </Empty>
        )}
      </div>
    );
  }
  if (book.isPending) {
    return (
      <div className="boot">
        <Spinner label="Opening the book" />
      </div>
    );
  }

  const b = book.data;
  const read = shelf.status === 'read' || shelf.stars > 0;
  return (
    <div className="page page--book">
      <article className="detail">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/discover">Discover</Link>
            <Icon name="chevron-right" size={14} />
            <Link to={`/recommendations?genre=${encodeURIComponent(b.primaryGenre)}`}>{b.primaryGenre}</Link>
            <Icon name="chevron-right" size={14} />
            <span>{b.title}</span>
          </nav>
          <div className="detail__grid">
            <aside className="detail__side">
              <div className="detail__cover">
                <Cover book={b} size="xl" eager />
              </div>
              <div className="detail__shelf">
                <ShelfControl book={b} />
                {shelf.status === 'currently_reading' && (
                  <div className="progress">
                    <Bar value={shelf.progress ?? 0} className="bar--progress" />
                    <span className="progress__val">{shelf.progress ?? 0}%</span>
                  </div>
                )}
                {!read && <DismissButton book={b} />}
              </div>
              <div className="detail__rate">
                <span className="label">Your rating</span>
                <RateWidget
                  value={shelf.stars}
                  onRate={(v) => rate.mutate({ bookId: b.bookId, stars: v })}
                  label={`Rate ${b.title}`}
                />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => openReview(b.bookId)}>
                  <Icon name="pen" size={15} stroke={2} />
                  <span>{shelf.reviewed ? 'Edit your review' : 'Write a review'}</span>
                </button>
              </div>
            </aside>
            <div className="detail__main">
              <p className="eyebrow">{b.genres.join(' · ')}</p>
              <h1 className="detail__title">{b.title}</h1>
              <p className="detail__author">
                by{' '}
                <Link className="link-underline" to={`/search?q=${encodeURIComponent(b.author ?? '')}`}>
                  {b.author}
                </Link>
              </p>
              {b.avgRating !== null && (
                <p className="detail__rating">
                  <Stars value={b.avgRating} large />
                  <b>{b.avgRating.toFixed(1)}</b>
                  {b.ratingsCount !== null && <span>{fmtCount(b.ratingsCount)} ratings</span>}
                </p>
              )}
              <dl className="facts">
                <div>
                  <dt>Genre</dt>
                  <dd>{b.primaryGenre}</dd>
                </div>
                <div>
                  <dt>Pages</dt>
                  <dd>{b.pages ?? '—'}</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>{b.year ?? '—'}</dd>
                </div>
                <div>
                  <dt>{b.series ? 'Series' : 'Rating'}</dt>
                  <dd>
                    {b.series
                      ? `${b.series.name ?? 'Series'}${b.series.pos ? `, #${b.series.pos}` : ''}`
                      : b.avgRating
                        ? `${b.avgRating.toFixed(1)} / 5`
                        : '—'}
                  </dd>
                </div>
              </dl>
              {b.description && <p className="detail__desc">{b.description}</p>}
              <WhyPanel bookId={b.bookId} read={read} />
              <BookDna bookId={b.bookId} />
              <Related bookId={b.bookId} author={b.author} />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
