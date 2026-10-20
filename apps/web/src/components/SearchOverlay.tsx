import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useSearch } from '../api/hooks';
import { errorMessage } from '../api/http';
import { useUi } from '../store/ui';
import { Cover } from './atoms';
import { Icon } from './Icon';

const MATCHED = { title: 'Title', author: 'Author', semantic: 'Meaning' } as const;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search from anywhere ("/" or Ctrl+K): titles, authors and meaning, with keyboard navigation. */
export function SearchOverlay() {
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  const query = useDebounced(q.trim(), 220);
  const search = useSearch(open ? query : '');
  const hits = search.data?.hits.slice(0, 8) ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    document.body.classList.add('is-locked');
    const raf = requestAnimationFrame(() => {
      setShown(true);
      input.current?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('is-locked');
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    setQ('');
  };
  const go = (path: string) => {
    close();
    navigate(path);
  };

  return createPortal(
    <div className={`search${shown ? ' is-open' : ''}`}>
      <div className="search__backdrop" onClick={close} />
      <div className="search__panel" role="dialog" aria-modal="true" aria-label="Search books">
        <div className="search__field">
          <Icon name="search" size={20} />
          <input
            ref={input}
            type="search"
            value={q}
            placeholder="Search by title, author, or describe a mood"
            autoComplete="off"
            spellCheck={false}
            aria-controls="search-results"
            aria-activedescendant={hits[active] ? `result-${hits[active]?.book.bookId}` : undefined}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(0, hits.length - 1)));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === 'Enter') {
                const hit = hits[active];
                if (hit) go(`/book/${hit.book.bookId}`);
                else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
              }
            }}
          />
          <button type="button" className="search__close" onClick={close} aria-label="Close search">
            Esc
          </button>
        </div>
        <div className="search__hint">
          {!query && (
            <p className="search__none">
              Try &ldquo;Andy Weir&rdquo;, &ldquo;Circe&rdquo; or &ldquo;a cozy book about found
              family&rdquo;.
            </p>
          )}
          {query && search.isError && <p className="search__none">{errorMessage(search.error)}</p>}
          {query && search.data && !hits.length && (
            <p className="search__none">Nothing matched &ldquo;{query}&rdquo;.</p>
          )}
          {search.data?.entity?.kind === 'author' && search.data.entity.author && (
            <p className="search__label">Books by {search.data.entity.author}</p>
          )}
          {search.data?.entity?.kind === 'ambiguous' && (
            <p className="search__label">Did you mean {search.data.entity.options.join(' or ')}?</p>
          )}
        </div>
        <ul className="search__results" id="search-results" role="listbox" aria-label="Search results">
          {hits.map((h, i) => (
            <li
              key={h.book.bookId}
              id={`result-${h.book.bookId}`}
              role="option"
              aria-selected={i === active}
              className={`result${i === active ? ' is-active' : ''}`}
            >
              <a
                className="result__link"
                href={`/book/${h.book.bookId}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(`/book/${h.book.bookId}`);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="result__cover">
                  <Cover book={h.book} size="xs" />
                </span>
                <span className="result__main">
                  <strong>{h.book.title}</strong>
                  <small>
                    {h.book.author} · {h.book.primaryGenre}
                    {h.book.year ? ` · ${h.book.year}` : ''}
                  </small>
                </span>
                <span className="result__meta">
                  <span className="result__matched">{MATCHED[h.matched]}</span>
                </span>
              </a>
            </li>
          ))}
          {query && hits.length > 0 && (
            <li className="result result--all">
              <a
                className="result__link result__link--all"
                href={`/search?q=${encodeURIComponent(query)}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(`/search?q=${encodeURIComponent(query)}`);
                }}
              >
                <span />
                <span className="result__main">
                  <strong>See every result for &ldquo;{query}&rdquo;</strong>
                </span>
                <Icon name="arrow-right" size={16} />
              </a>
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
