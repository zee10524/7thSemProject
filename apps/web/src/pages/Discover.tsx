import { type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { RecItemDto } from '@litsense/shared';
import { useMe, useRails, useRecentReads } from '../api/hooks';
import {
  Cover,
  ErrorState,
  RankBadge,
  Reveal,
  Section,
  SectionHead,
  SkeletonCards,
} from '../components/atoms';
import { CardGrid, MiniCard } from '../components/cards';
import { Icon } from '../components/Icon';
import { ago, pad2 } from '../lib/format';
import { bookHref, CHAT_STARTERS } from '../lib/links';

interface Rail {
  id: string;
  title: ReactNode;
  index: string;
  sub?: ReactNode;
  kicker?: string;
  body: ReactNode;
  href?: string;
  more?: string;
}

function Hero({ feature, rails, name }: { feature: RecItemDto | undefined; rails: Rail[]; name: string }) {
  return (
    <Reveal className="hero hero--editorial">
      <div className="container">
        <div className="hero__strip">
          <span>The front page</span>
          <span>Picked for {name}</span>
          <span>Updated from your shelves, every visit</span>
        </div>
        <div className="hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">The Reader&rsquo;s Edition</p>
            <h1 className="hero__title">
              Books you&rsquo;ll <span className="scribble">actually</span> want to finish.
            </h1>
            <p className="hero__deck">
              <span className="dropcap">L</span>itSense learns from what you read, what you rate, and what you
              say you loved. Then it tells you, in plain words, why each book made the page.
            </p>
            <div className="hero__cta">
              <Link className="btn btn--primary btn--lg" to="/recommendations">
                <span>Explore recommendations</span>
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link className="link-underline" to="/chat">
                Ask LitSense
              </Link>
            </div>
          </div>
          {feature ? (
            <figure className="hero__feature">
              <span className="hero__tape" aria-hidden="true" />
              <Link
                className="hero__cover"
                to={bookHref(feature.book)}
                aria-label={`Open ${feature.book.title}`}
              >
                <Cover book={feature.book} size="xl" eager />
              </Link>
              <RankBadge rank={1} variant="stamp" />
              <figcaption>
                <span className="eyebrow">Editor&rsquo;s pick</span>
                <strong>{feature.book.title}</strong>
                <span>{feature.book.author}</span>
                <em className="hand">start here, this one is yours</em>
              </figcaption>
            </figure>
          ) : (
            <figure className="hero__feature hero__feature--empty">
              <figcaption>
                <span className="eyebrow">Editor&rsquo;s pick</span>
                <strong>Rate a book to get your first pick</strong>
              </figcaption>
            </figure>
          )}
          <aside className="hero__index" aria-label="In this issue">
            <h2 className="hero__index-title">In this issue</h2>
            <ol>
              {rails.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(`sec-${r.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    <span className="num">{pad2(i + 1)}</span>
                    <span>{r.index}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </Reveal>
  );
}

function BecauseRail({ rails }: { rails: { anchor: RecItemDto['book']; items: RecItemDto[] }[] }) {
  const [active, setActive] = useState(0);
  const current = rails[Math.min(active, rails.length - 1)];
  if (!current) return null;
  return (
    <>
      {rails.length > 1 && (
        <div className="chips chips--anchor" role="group" aria-label="Choose a book">
          {rails.map((r, i) => (
            <button
              key={r.anchor.bookId}
              type="button"
              className={`chip chip--book${i === active ? ' is-active' : ''}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            >
              <span className="chip__thumb">
                <Cover book={r.anchor} size="xs" />
              </span>
              <span>{r.anchor.title}</span>
            </button>
          ))}
        </div>
      )}
      <CardGrid items={current.items.slice(0, 8)} compact />
    </>
  );
}

export default function DiscoverPage() {
  const me = useMe();
  const rails = useRails();
  const recent = useRecentReads();
  const navigate = useNavigate();

  if (rails.isPending) {
    return (
      <div className="container section">
        <SkeletonCards count={4} />
      </div>
    );
  }
  if (rails.isError) {
    return (
      <div className="container">
        <ErrorState error={rails.error} onRetry={() => void rails.refetch()} />
      </div>
    );
  }

  const r = rails.data;
  const firstAnchor = r.becauseYouLiked[0]?.anchor;
  const latest = recent.data?.[0];
  const list: Rail[] = [];
  if (r.topPicks.length)
    list.push({
      id: 'top',
      index: 'Top picks for you',
      kicker: 'Your next great read is probably hiding here.',
      title: (
        <>
          Top picks <em>for you</em>
        </>
      ),
      sub: 'Chosen from your shelves, your ratings and what readers like you loved.',
      href: '/recommendations',
      more: 'All recommendations',
      body: <CardGrid items={r.topPicks.slice(0, 6)} cls="cards--top" />,
    });
  if (r.becauseYouLiked.length)
    list.push({
      id: 'because',
      index: 'Because you loved…',
      title: 'Because you loved…',
      sub: firstAnchor ? (
        <>
          Books that share the strengths of <strong>{firstAnchor.title}</strong>.
        </>
      ) : undefined,
      body: <BecauseRail rails={r.becauseYouLiked} />,
    });
  if (r.continueSeries.length)
    list.push({
      id: 'series',
      index: 'Continue the series',
      title: 'Continue the series',
      sub: 'The next volume of a series you have started. Later volumes wait until you get there.',
      body: <CardGrid items={r.continueSeries} compact />,
    });
  if (recent.data?.length)
    list.push({
      id: 'recent',
      index: 'Recently read…',
      title: 'Recently read…',
      sub: 'Your latest finished books. Finished something new? Tell us what you loved.',
      href: '/my-books',
      more: 'My Books',
      body: (
        <div className="strip">
          {recent.data.slice(0, 5).map((x, i) => (
            <MiniCard key={x.book.bookId} book={x.book} i={i} note={`Finished ${ago(x.finishedAt)}`} />
          ))}
          {latest && (
            <Link className="strip__cta" to={`/recent/${latest.book.bookId}`}>
              <span className="eyebrow">Just finished {latest.book.title}?</span>
              <strong>See what to read next</strong>
              <Icon name="arrow-right" size={20} />
            </Link>
          )}
        </div>
      ),
    });
  if (r.hiddenGems.length)
    list.push({
      id: 'gems',
      index: 'Hidden gems',
      title: 'Hidden gems',
      sub: 'Loved by readers with your taste, and far less talked about.',
      body: <CardGrid items={r.hiddenGems.slice(0, 8)} compact />,
    });
  if (r.moreByAuthors.length)
    list.push({
      id: 'authors',
      index: 'More from authors you love',
      title: 'More from authors you love',
      sub: 'You rated their books highly, so we looked for more.',
      body: <CardGrid items={r.moreByAuthors.slice(0, 8)} compact />,
    });
  if (r.continueExploring.length)
    list.push({
      id: 'exploring',
      index: 'Continue exploring',
      title: 'Continue exploring',
      sub: 'Close to the books you looked at recently.',
      body: <CardGrid items={r.continueExploring.slice(0, 8)} compact />,
    });
  if (r.fromReadingList.length)
    list.push({
      id: 'list',
      index: 'From your reading list',
      title: 'In the spirit of your list',
      sub: 'Books like the ones waiting on your Want to Read shelf.',
      body: <CardGrid items={r.fromReadingList.slice(0, 8)} compact />,
    });
  if (r.trending.length)
    list.push({
      id: 'trending',
      index: 'Popular right now',
      title: 'Popular right now',
      sub: 'What readers are picking up this season.',
      body: <CardGrid items={r.trending.slice(0, 8)} compact />,
    });

  return (
    <div className="page page--discover">
      <Hero feature={r.topPicks[0]} rails={list} name={me.data?.name ?? 'you'} />
      {list.map((rail, i) => (
        <Section key={rail.id} id={`sec-${rail.id}`} cls={rail.id}>
          <SectionHead
            no={pad2(i + 1)}
            kicker={rail.kicker}
            title={rail.title}
            sub={rail.sub}
            href={rail.href}
            more={rail.more}
          />
          {rail.body}
        </Section>
      ))}
      <Reveal className="section section--ask">
        <div className="container">
          <div className="ask">
            <div className="ask__text">
              <p className="eyebrow">Ask LitSense</p>
              <h2 className="ask__title">Not sure what you are in the mood for?</h2>
              <p className="ask__sub">Tell the concierge. It will find the book, and explain the choice.</p>
            </div>
            <div className="ask__chips">
              {CHAT_STARTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  onClick={() => navigate(`/chat?prompt=${encodeURIComponent(t)}`)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
