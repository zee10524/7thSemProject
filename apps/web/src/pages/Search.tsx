import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSearch } from '../api/hooks';
import { Cover, Empty, ErrorState, PageHead, SkeletonCards } from '../components/atoms';
import { RatingLine } from '../components/cards';
import { bookHref } from '../lib/links';
import { Icon } from '../components/Icon';
import { ShelfControl } from '../components/shelf';

const MATCHED = { title: 'Title match', author: 'Author match', semantic: 'Matches the meaning' } as const;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const search = useSearch(q);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) setParams({ q: draft.trim() });
  };

  return (
    <div className="page page--search">
      <PageHead
        eyebrow="Search"
        title={q ? <>&ldquo;{q}&rdquo;</> : 'Find a book'}
        sub="Search by title or author, or describe what you are in the mood for."
      >
        <form className="composer search-page__form" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="searchPageInput">
            Search books
          </label>
          <input
            id="searchPageInput"
            className="composer__input"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Andy Weir, Circe, or a cozy mystery with a found family"
          />
          <button className="composer__send" type="submit" aria-label="Search">
            <Icon name="search" size={20} />
          </button>
        </form>
      </PageHead>
      <section className="section section--search">
        <div className="container">
          {!q ? null : search.isPending ? (
            <SkeletonCards count={4} />
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => void search.refetch()} />
          ) : (
            <>
              {search.data.entity?.kind === 'ambiguous' && (
                <p className="notice">
                  Did you mean{' '}
                  {search.data.entity.options.map((o, i) => (
                    <span key={o}>
                      {i > 0 && ' or '}
                      <button
                        type="button"
                        className="link-underline"
                        onClick={() => {
                          setDraft(o);
                          setParams({ q: o });
                        }}
                      >
                        {o}
                      </button>
                    </span>
                  ))}
                  ?
                </p>
              )}
              {search.data.entity?.kind === 'author' && (
                <p className="notice">Showing books by {search.data.entity.author} first.</p>
              )}
              {search.data.hits.length ? (
                <ul className="search-list">
                  {search.data.hits.map((h) => (
                    <li key={h.book.bookId} className="search-list__item">
                      <Link
                        className="search-list__cover"
                        to={bookHref(h.book)}
                        aria-label={`Open ${h.book.title}`}
                      >
                        <Cover book={h.book} size="sm" />
                      </Link>
                      <div className="search-list__body">
                        <span className="result__matched">{MATCHED[h.matched]}</span>
                        <h2 className="card__title">
                          <Link to={bookHref(h.book)}>{h.book.title}</Link>
                        </h2>
                        <p className="card__author">{h.book.author}</p>
                        <RatingLine book={h.book} />
                        {h.book.description && <p className="search-list__desc">{h.book.description}</p>}
                      </div>
                      <div className="search-list__actions">
                        <ShelfControl book={h.book} short />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon="search" title={`Nothing matched "${q}"`}>
                  Try fewer words, an author&rsquo;s surname, or describe the mood instead.
                </Empty>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
