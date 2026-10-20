import { type CSSProperties, type ElementType, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { BookDto } from '@litsense/shared';
import { errorMessage, isApiError } from '../api/http';
import { coverStyleFor, coverUrl } from '../lib/cover';
import { Icon } from './Icon';
import { motifSvg } from './motifs';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** CSS-drawn cover (prototype design) with the real image fading in on top when it loads. */
export function Cover({ book, size = 'md', eager = false }: { book: BookDto; size?: Size; eager?: boolean }) {
  const style = coverStyleFor(book);
  const url = coverUrl(book.image, size);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed');
  const len = book.title.length;
  const lenKey = len <= 12 ? 's' : len <= 22 ? 'm' : len <= 32 ? 'l' : 'xl';
  return (
    <span
      className={`cover cover--${size}${state === 'loaded' ? ' has-img' : ''}`}
      role="img"
      aria-label={`Cover of ${book.title}`}
      data-layout={style.layout}
      data-font={style.font}
      data-len={lenKey}
      style={{ '--c1': style.c1, '--c2': style.c2, '--ci': style.ink, '--ca': style.accent } as CSSProperties}
    >
      <span className="cover__art">
        <svg
          className="cover__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
          dangerouslySetInnerHTML={{ __html: motifSvg(style.motif) }}
        />
      </span>
      <span className="cover__band" />
      <span className="cover__title">{book.title}</span>
      <span className="cover__author">{book.author ?? ''}</span>
      {url && state !== 'failed' && (
        <img
          className={`cover__img${state === 'loaded' ? ' is-loaded' : ''}`}
          src={url}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => setState(e.currentTarget.naturalWidth > 1 ? 'loaded' : 'failed')}
          onError={() => setState('failed')}
        />
      )}
    </span>
  );
}

export function Stars({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <span
      className={`stars${large ? ' stars--lg' : ''}`}
      style={{ '--r': value } as CSSProperties}
      role="img"
      aria-label={`${value} out of 5 stars`}
    />
  );
}

/** Half-star rating control: ten invisible buttons over the stars, each focusable and labelled. */
export function RateWidget({
  value,
  onRate,
  disabled,
  label,
}: {
  value: number;
  onRate: (stars: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="rate" style={{ '--r': shown } as CSSProperties} onMouseLeave={() => setHover(null)}>
      <span className="rate__stars">
        <span className="stars stars--lg" style={{ '--r': shown } as CSSProperties} />
        <span className="rate__hits" role="group" aria-label={label ?? 'Rate this book'}>
          {Array.from({ length: 10 }, (_, i) => (i + 1) / 2).map((v) => (
            <button
              key={v}
              type="button"
              className="rate__hit"
              aria-label={`${v} stars`}
              aria-pressed={value === v}
              disabled={disabled}
              onMouseEnter={() => setHover(v)}
              onFocus={() => setHover(v)}
              onBlur={() => setHover(null)}
              onClick={() => onRate(v)}
            />
          ))}
        </span>
      </span>
      <span className="rate__label" aria-live="polite">
        {value ? value.toFixed(1) : 'Rate this book'}
      </span>
    </div>
  );
}

export function Bar({ value, pref, className }: { value: number; pref?: number | null; className?: string }) {
  return (
    <span
      className={`bar${className ? ` ${className}` : ''}`}
      style={
        { '--v': value, ...(pref !== null && pref !== undefined ? { '--pref': pref } : {}) } as CSSProperties
      }
    >
      <span className="bar__track">
        <i />
      </span>
      {pref !== null && pref !== undefined && <b className="bar__pref" title="Your preference" />}
    </span>
  );
}

export function AspectRow({
  no,
  label,
  value,
  pref,
  suffix = '',
  className,
}: {
  no?: string;
  label: string;
  value: number;
  pref?: number | null;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`aspect${no ? '' : ' aspect--plain'}${className ? ` ${className}` : ''}`}>
      {no && <span className="aspect__no">{no}</span>}
      <span className="aspect__name">{label}</span>
      <Bar value={value} pref={pref} />
      <span className="aspect__val">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function Tag({ kind, children }: { kind: 'pos' | 'neg' | 'neutral'; children: ReactNode }) {
  return (
    <li className={`tag tag--${kind}`}>
      {kind !== 'neutral' && (
        <span className="tag__sign">
          <Icon name={kind === 'pos' ? 'plus' : 'minus'} size={12} stroke={2.4} />
        </span>
      )}
      <span className="tag__text">{children}</span>
    </li>
  );
}

/**
 * The prototype's match dial, used honestly: the contract gives a rank, not a match percentage,
 * so the dial shows the pick's position in the list.
 */
export function RankBadge({
  rank,
  variant = 'badge',
}: {
  rank: number;
  variant?: 'badge' | 'stamp' | 'lg' | 'md';
}) {
  return (
    <span
      className={`match match--${variant} match--rank`}
      style={{ '--v': 100 } as CSSProperties}
      title={`Pick number ${rank}`}
    >
      <span className="match__dial">
        <span className="match__ring" />
        <span className="match__num">
          <small>No.</small>
          {rank}
        </span>
      </span>
      <span className="match__label">pick</span>
    </span>
  );
}

export function SectionHead({
  no,
  kicker,
  title,
  sub,
  href,
  more,
  extra,
}: {
  no?: string;
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  href?: string;
  more?: string;
  extra?: ReactNode;
}) {
  return (
    <header className="shead">
      <div className="shead__text">
        {no && (
          <span className="shead__no" aria-hidden="true">
            {no}
          </span>
        )}
        {kicker && <p className="shead__kicker">{kicker}</p>}
        <h2 className="shead__title">{title}</h2>
        {sub && <p className="shead__sub">{sub}</p>}
      </div>
      {extra && <div className="shead__extra">{extra}</div>}
      {href && (
        <Link className="shead__more link-arrow" to={href}>
          <span>{more ?? 'See all'}</span>
          <Icon name="arrow-right" size={16} />
        </Link>
      )}
    </header>
  );
}

export function PageHead({
  eyebrow,
  title,
  sub,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal as="header" className={`page-head${className ? ` ${className}` : ''}`}>
      <div className="container">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
        {children}
      </div>
    </Reveal>
  );
}

/** Fades content in when it scrolls into view (the prototype's data-reveal), and fills its bars. */
export function Reveal<T extends ElementType = 'section'>({
  as,
  className,
  children,
  id,
}: {
  as?: T;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const Tag = (as ?? 'section') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <Tag ref={ref} id={id} className={`${className ?? ''}${shown ? ' is-in' : ''}`} data-reveal="">
      {children}
    </Tag>
  );
}

export function Section({ id, cls, children }: { id?: string; cls: string; children: ReactNode }) {
  return (
    <Reveal className={`section section--${cls}`} id={id}>
      <div className="container">{children}</div>
    </Reveal>
  );
}

export function Empty({
  icon = 'book-open',
  title,
  children,
  action,
}: {
  icon?: 'book-open' | 'search' | 'compass' | 'chat' | 'sparkle';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={28} stroke={1.4} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const modelDown =
    isApiError(error) && (error.code === 'MODEL_UNAVAILABLE' || error.code === 'MODEL_BAD_RESPONSE');
  return (
    <div className="empty" role="alert">
      <span className="empty__icon">
        <Icon name={modelDown ? 'clock' : 'info'} size={28} stroke={1.4} />
      </span>
      <h3>{modelDown ? 'The recommender is taking a breather' : 'That did not load'}</h3>
      <p>{modelDown ? 'Your shelves are safe. Picks will be back in a moment.' : errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--primary btn--sm" onClick={onRetry}>
          <Icon name="refresh" size={15} />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}

export function SkeletonCards({ count = 4, wide = false }: { count?: number; wide?: boolean }) {
  return (
    <div className={`cards ${wide ? 'cards--wide' : 'cards--4'}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skel-card${wide ? ' skel-card--wide' : ''}`}>
          <span className="skel skel--cover" />
          <span className="skel skel--line" />
          <span className="skel skel--line skel--short" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner" role="status" aria-label={label}>
      <span className="typing__dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
