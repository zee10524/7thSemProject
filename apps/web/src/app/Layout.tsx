import { useEffect } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { useMe, useMeta } from '../api/hooks';
import { Icon, type IconName } from '../components/Icon';
import { ReviewModal } from '../components/ReviewModal';
import { SearchOverlay } from '../components/SearchOverlay';
import { Toasts } from '../components/overlays';
import { mastheadDate } from '../lib/format';
import { useUi } from '../store/ui';

const LINKS = [
  { to: '/discover', label: 'Discover' },
  { to: '/my-books', label: 'My Books' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/recent', label: 'Recent Reads' },
  { to: '/chat', label: 'Ask LitSense' },
];

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/discover', label: 'Home', icon: 'home' },
  { to: '/my-books', label: 'Books', icon: 'book-open' },
  { to: '/recommendations', label: 'Picks', icon: 'compass' },
  { to: '/chat', label: 'Ask', icon: 'chat' },
  { to: '/account', label: 'You', icon: 'user' },
];

function useBodyPage() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.body.dataset.page = pathname.split('/')[1] || 'discover';
  }, [pathname]);
}

export function Masthead() {
  return (
    <div className="masthead">
      <div className="masthead__row">
        <span>{mastheadDate()}</span>
        <span>Vol. 07 &middot; The Reader&rsquo;s Edition</span>
        <span>Review-aware &middot; Explainable &middot; Conversational</span>
      </div>
      <Link className="masthead__title" to="/discover">
        LitSense
      </Link>
      <p className="masthead__tag">From knowing what a reader liked, to understanding why they liked it.</p>
    </div>
  );
}

function Brand() {
  return (
    <Link className="brand" to="/discover" aria-label="LitSense home">
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M8 3h16v26l-8-6-8 6z" fill="currentColor" />
        <path d="M16 7Q16 12 21 12Q16 12 16 17Q16 12 11 12Q16 12 16 7Z" fill="var(--mark-spark, #fff)" />
      </svg>
      <span className="brand__name">LitSense</span>
    </Link>
  );
}

export function AppLayout() {
  useBodyPage();
  const me = useMe();
  const meta = useMeta();
  const openSearch = useUi((s) => s.setSearchOpen);
  const initial = (me.data?.name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <>
      <a className="skip" href="#view">
        Skip to content
      </a>
      <Masthead />
      <header className="site-header">
        <nav className="nav" aria-label="Primary">
          <Brand />
          <ul className="nav__links">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`} to={l.to}>
                  <span>{l.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="nav__actions">
            <button
              className="nav__search"
              type="button"
              onClick={() => openSearch(true)}
              aria-label="Search books"
            >
              <Icon name="search" size={18} />
              <span className="nav__search-text">Search books, authors, genres</span>
              <kbd>/</kbd>
            </button>
            <NavLink
              className={({ isActive }) => `nav__profile${isActive ? ' is-active' : ''}`}
              to="/account"
              aria-label="Your account and settings"
            >
              <span className="avatar">{initial}</span>
            </NavLink>
          </div>
        </nav>
      </header>

      <main id="view" className="view view--enter" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <strong className="site-footer__name">LitSense</strong>
            <p>From knowing what a reader liked, to understanding why they liked it.</p>
          </div>
          <ul className="site-footer__links">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/account">Account</Link>
            </li>
            {me.data?.role === 'admin' && (
              <li>
                <Link to="/admin">Admin</Link>
              </li>
            )}
          </ul>
          <p className="site-footer__note">
            Picks come from the LitSense recommender; language models only explain them and never choose
            books.
            {meta.data?.modelMode === 'mock' &&
              ' Demo mode: the recommender is running on a small sample catalogue.'}{' '}
            Cover images courtesy of Open Library.
          </p>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Mobile navigation">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            className={({ isActive }) => `tabbar__item${isActive ? ' is-active' : ''}`}
            to={t.to}
          >
            <Icon name={t.icon} size={22} stroke={1.7} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>

      <SearchOverlay />
      <ReviewModal />
      <Toasts />
      <ScrollRestoration />
    </>
  );
}

/** Sign-in pages: the masthead and a single column, no app navigation. */
export function AuthLayout() {
  useBodyPage();
  return (
    <>
      <Masthead />
      <main id="view" className="view view--enter auth-view" tabIndex={-1}>
        <Outlet />
      </main>
      <Toasts />
    </>
  );
}
