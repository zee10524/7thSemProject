import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import type { BookDto, RecItemDto } from '@litsense/shared';
import { RankBadge, Stars, Cover } from './atoms';
import { Icon } from './Icon';
import { DismissButton, ShelfControl } from './shelf';
import { AspectChart, EvidenceTags, Why, WhyButton } from './why';
import { parseEvidence } from '../lib/evidence';
import { bookHref } from '../lib/links';
import { useShelf } from '../lib/shelfState';

function Meta({ book }: { book: BookDto }) {
  return (
    <p className="card__meta">
      <span>{book.primaryGenre}</span>
      {book.series?.name && (
        <>
          <i />
          <span>
            {book.series.name}
            {book.series.pos ? ` #${book.series.pos}` : ''}
          </span>
        </>
      )}
    </p>
  );
}

export function RatingLine({ book, genres = false }: { book: BookDto; genres?: boolean }) {
  return (
    <p className="card__rating">
      {book.avgRating !== null && (
        <>
          <Stars value={book.avgRating} />
          <b>{book.avgRating.toFixed(1)}</b>
        </>
      )}
      {book.pages !== null && <span className="card__pages">{book.pages} pages</span>}
      {book.year !== null && <span className="card__pages">{book.year}</span>}
      {genres && <span className="card__genres">{book.genres.join(' · ')}</span>}
    </p>
  );
}

/** Vertical recommendation card (Discover rails). */
export function RecCard({
  item,
  i = 0,
  compact = false,
  dismissible = true,
}: {
  item: RecItemDto;
  i?: number;
  compact?: boolean;
  dismissible?: boolean;
}) {
  const b = item.book;
  return (
    <article
      className={`card card--rec${compact ? ' card--compact' : ''}`}
      style={{ '--i': i } as CSSProperties}
    >
      <Link className="card__cover" to={bookHref(b)} aria-label={`Open ${b.title}`}>
        <Cover book={b} size="md" />
        <RankBadge rank={item.rank} />
      </Link>
      <div className="card__body">
        <Meta book={b} />
        <h3 className="card__title">
          <Link to={bookHref(b)}>{b.title}</Link>
        </h3>
        <p className="card__author">{b.author}</p>
        <RatingLine book={b} />
        {compact ? (
          <>
            <p className="card__bridge">{item.reason}</p>
            <EvidenceTags evidence={item.evidence} max={3} />
          </>
        ) : (
          <Why book={b} reason={item.reason} evidence={item.evidence} />
        )}
        <div className="card__actions">
          <ShelfControl book={b} short={compact} />
          {dismissible && !compact && <DismissButton book={b} />}
        </div>
      </div>
    </article>
  );
}

/** Wide card with aspect bars (Recommendations page). */
export function RecWide({ item, i = 0 }: { item: RecItemDto; i?: number }) {
  const b = item.book;
  return (
    <article className="card card--wide" style={{ '--i': i } as CSSProperties}>
      <Link className="card__cover" to={bookHref(b)} aria-label={`Open ${b.title}`}>
        <Cover book={b} size="md" />
      </Link>
      <div className="card__body">
        <div className="card__head">
          <div>
            <Meta book={b} />
            <h3 className="card__title">
              <Link to={bookHref(b)}>{b.title}</Link>
            </h3>
            <p className="card__author">{b.author}</p>
            <RatingLine book={b} genres />
          </div>
          <RankBadge rank={item.rank} variant="lg" />
        </div>
        <div className="card__split">
          <div className="card__aspects">
            <span className="label">What reviewers praise</span>
            <AspectChart evidence={item.evidence} />
          </div>
          <div className="card__why">
            <Why book={b} reason={item.reason} evidence={item.evidence} />
          </div>
        </div>
        <div className="card__actions">
          <ShelfControl book={b} />
          <DismissButton book={b} />
          <Link className="btn btn--ghost btn--sm" to={bookHref(b)}>
            <span>Details</span>
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Large explainable card (top pick, next reads). */
export function FeatureRec({
  item,
  rank,
  i = 0,
  note,
}: {
  item: RecItemDto;
  rank?: string;
  i?: number;
  note?: ReactNode;
}) {
  const b = item.book;
  const ev = parseEvidence(item.evidence);
  return (
    <article className="card card--feature" style={{ '--i': i } as CSSProperties}>
      {rank && (
        <span className="card__rank" aria-hidden="true">
          {rank}
        </span>
      )}
      <Link className="card__cover" to={bookHref(b)} aria-label={`Open ${b.title}`}>
        <Cover book={b} size="lg" />
      </Link>
      <div className="card__body">
        <div className="card__head">
          <div>
            <Meta book={b} />
            <h3 className="card__title">
              <Link to={bookHref(b)}>{b.title}</Link>
            </h3>
            <p className="card__author">{b.author}</p>
            <RatingLine book={b} genres />
          </div>
          <RankBadge rank={item.rank} variant="lg" />
        </div>
        <p className="card__bridge">{note ?? item.reason}</p>
        <div className="card__split">
          <div className="card__reasons">
            <span className="label">Why it matches</span>
            <ul className="plus-list">
              <li className="plus">
                <span className="plus__icon">
                  <Icon name="plus" size={14} stroke={2.4} />
                </span>
                <span className="plus__text">{item.reason}</span>
              </li>
              {ev.positives.map((p) => (
                <li key={p.aspect} className="plus">
                  <span className="plus__icon">
                    <Icon name="plus" size={14} stroke={2.4} />
                  </span>
                  <span className="plus__text">Praised for its {p.label}</span>
                  <b>{Math.round(p.strength * 100)}%</b>
                </li>
              ))}
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
          <div className="card__aspects">
            <span className="label">What reviewers praise</span>
            <AspectChart evidence={item.evidence} />
          </div>
        </div>
        <p className="card__spoiler">
          <Icon name="shield" size={14} />
          <span>Spoiler-safe explanation, built from your shelves and reader reviews.</span>
        </p>
        <div className="card__actions">
          <ShelfControl book={b} />
          <WhyButton
            book={b}
            reason={item.reason}
            evidence={item.evidence}
            className="btn btn--ghost btn--sm"
          />
          <DismissButton book={b} />
        </div>
      </div>
    </article>
  );
}

/** Small card for finished books and related strips. */
export function MiniCard({ book, i = 0, note }: { book: BookDto; i?: number; note?: string }) {
  const { stars } = useShelf(book.bookId);
  return (
    <article className="mini" style={{ '--i': i } as CSSProperties}>
      <Link className="mini__cover" to={bookHref(book)} aria-label={`Open ${book.title}`}>
        <Cover book={book} size="md" />
      </Link>
      <div className="mini__body">
        <h3 className="mini__title">
          <Link to={bookHref(book)}>{book.title}</Link>
        </h3>
        <p className="mini__author">{book.author}</p>
        {stars > 0 && (
          <p className="mini__rating">
            <Stars value={stars} />
            <b>{stars.toFixed(1)}</b>
          </p>
        )}
        {note && <p className="mini__note">{note}</p>}
      </div>
    </article>
  );
}

export function CardGrid({
  items,
  cls = 'cards--4',
  compact = false,
}: {
  items: RecItemDto[];
  cls?: string;
  compact?: boolean;
}) {
  return (
    <div className={`cards ${cls}`}>
      {items.map((it, i) => (
        <RecCard key={it.book.bookId} item={it} i={i} compact={compact} />
      ))}
    </div>
  );
}
