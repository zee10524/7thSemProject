import { Link, useNavigate, useParams } from 'react-router';
import { useRecentReads, useSimilar } from '../api/hooks';
import {
  Cover,
  Empty,
  ErrorState,
  PageHead,
  Section,
  SectionHead,
  SkeletonCards,
  Stars,
  Tag,
} from '../components/atoms';
import { CardGrid, FeatureRec } from '../components/cards';
import { bookHref } from '../lib/links';
import { Icon } from '../components/Icon';
import { aspectLabel } from '../lib/evidence';
import { ago, pad2 } from '../lib/format';
import { useUi } from '../store/ui';

function NextReads({ bookId, title }: { bookId: number; title: string }) {
  const next = useSimilar(bookId, 7);
  if (next.isPending) return <SkeletonCards count={3} wide />;
  if (next.isError) return <ErrorState error={next.error} onRetry={() => void next.refetch()} />;
  if (!next.data.length)
    return <Empty title="Nothing close enough yet">Rate a few more books and next reads appear here.</Empty>;
  return (
    <>
      <div className="cards cards--feature">
        {next.data.slice(0, 3).map((it, i) => (
          <FeatureRec
            key={it.book.bookId}
            item={it}
            rank={pad2(i + 1)}
            i={i}
            note={`Echoes ${title}. ${it.reason}.`}
          />
        ))}
      </div>
      {next.data.length > 3 && (
        <>
          <h3 className="subhead">More next reads</h3>
          <CardGrid items={next.data.slice(3)} compact />
        </>
      )}
    </>
  );
}

export default function RecentReadsPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const recent = useRecentReads();
  const openReview = useUi((s) => s.openReview);

  const head = (
    <PageHead
      eyebrow="Fresh off the shelf"
      title={
        <>
          Because you just <em>finished&hellip;</em>
        </>
      }
    />
  );

  if (recent.isPending) {
    return (
      <div className="page page--recent">
        {head}
        <div className="container">
          <SkeletonCards count={3} />
        </div>
      </div>
    );
  }
  if (recent.isError) {
    return (
      <div className="page page--recent">
        {head}
        <div className="container">
          <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
        </div>
      </div>
    );
  }
  if (!recent.data.length) {
    return (
      <div className="page page--recent">
        {head}
        <div className="container">
          <Empty
            title="Finish a book first"
            action={
              <Link className="btn btn--primary btn--sm" to="/my-books">
                Open My Books
              </Link>
            }
          >
            When you mark a book as read, its next reads appear here.
          </Empty>
        </div>
      </div>
    );
  }

  const cur = recent.data.find((x) => String(x.book.bookId) === bookId) ?? recent.data[0]!;
  const b = cur.book;
  const loved = Object.entries(cur.review?.aspects ?? {})
    .filter(([, v]) => v > 0.05)
    .sort((a, z) => z[1] - a[1]);

  return (
    <div className="page page--recent">
      {head}
      <Section id="sec-finished" cls="finished">
        <div className="finished">
          <Link className="finished__cover" to={bookHref(b)} aria-label={`Open ${b.title}`}>
            <Cover book={b} size="xl" eager />
          </Link>
          <div className="finished__body">
            <h2 className="finished__title">{b.title}</h2>
            <p className="finished__author">{b.author}</p>
            <p className="finished__meta">
              {cur.stars ? (
                <>
                  <Stars value={cur.stars} />
                  <b>{cur.stars.toFixed(1)}</b>
                  <i />
                </>
              ) : null}
              <span>Finished {ago(cur.finishedAt)}</span>
            </p>
            {cur.review ? (
              <blockquote className="finished__quote">&ldquo;{cur.review.text}&rdquo;</blockquote>
            ) : (
              <p className="finished__quote finished__quote--empty">
                You have not reviewed this yet. A few words sharpen the next picks.
              </p>
            )}
            <div className="finished__loved">
              <span className="label">What LitSense heard you loved</span>
              <ul className="evidence">
                {loved.length ? (
                  loved.map(([a]) => (
                    <Tag key={a} kind="pos">
                      {aspectLabel(a)}
                    </Tag>
                  ))
                ) : (
                  <li className="tag tag--neutral">
                    {cur.review ? 'Still reading your review' : 'Nothing yet: write a review'}
                  </li>
                )}
              </ul>
            </div>
            <div className="finished__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => openReview(b.bookId)}>
                <Icon name="pen" size={15} stroke={2} />
                <span>{cur.review ? 'Edit review' : 'Add review'}</span>
              </button>
              <Link className="btn btn--ghost btn--sm" to={bookHref(b)}>
                <span>Book DNA</span>
                <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </div>
        </div>
        {recent.data.length > 1 && (
          <div className="switcher">
            <span className="switcher__label">Or start from another recent read</span>
            <div className="switcher__list">
              {recent.data.map((x) => {
                const on = x.book.bookId === b.bookId;
                return (
                  <button
                    key={x.book.bookId}
                    type="button"
                    className={`switcher__item${on ? ' is-active' : ''}`}
                    aria-pressed={on}
                    title={x.book.title}
                    onClick={() => navigate(`/recent/${x.book.bookId}`, { replace: true })}
                  >
                    <Cover book={x.book} size="sm" />
                    <span>{x.book.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Section>
      <Section id="sec-next" cls="next">
        <SectionHead
          title="Your next reads"
          sub={`Ranked by your taste, then by how closely each book echoes ${b.title}.`}
        />
        <NextReads key={b.bookId} bookId={b.bookId} title={b.title} />
      </Section>
    </div>
  );
}
