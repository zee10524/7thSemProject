import { useEffect, useId, useState } from 'react';
import { useBook, useDeleteReview, useReview, useSaveReview } from '../api/hooks';
import { errorMessage } from '../api/http';
import { aspectLabel } from '../lib/evidence';
import { toast, useUi } from '../store/ui';
import { Cover, RateWidget, Spinner, Tag } from './atoms';
import { Icon } from './Icon';
import { Modal } from './overlays';
import { useShelf } from '../lib/shelfState';

const MAX = 2000;

/** Write or edit a review. Saving queues aspect analysis on the server; the result appears here. */
export function ReviewModal() {
  const bookId = useUi((s) => s.reviewBookId);
  const close = useUi((s) => s.closeReview);
  if (bookId === null) return null;
  return <ReviewDialog key={bookId} bookId={bookId} onClose={close} />;
}

function ReviewDialog({ bookId, onClose }: { bookId: number; onClose: () => void }) {
  const titleId = useId();
  const book = useBook(bookId);
  const review = useReview(bookId);
  const shelf = useShelf(bookId);
  const save = useSaveReview();
  const remove = useDeleteReview();
  const [text, setText] = useState('');
  const [stars, setStars] = useState(0);
  const [markRead, setMarkRead] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || review.isPending) return;
    setText(review.data?.text ?? '');
    setStars(shelf.stars || review.data?.stars || 0);
    setLoaded(true);
  }, [loaded, review.isPending, review.data, shelf.stars]);

  const analysis = review.data?.analysis;
  const needsRead = shelf.status !== 'read';
  const submit = () =>
    save.mutate(
      {
        bookId,
        text: text.trim(),
        ...(stars ? { stars } : {}),
        ...(needsRead && markRead && !stars ? { markRead: true } : {}),
      },
      { onSuccess: () => toast('Review saved. LitSense is reading it now.') },
    );

  return (
    <Modal open onClose={onClose} labelledBy={titleId} className="modal__panel--review">
      {!book.data ? (
        <Spinner />
      ) : (
        <div className="review-modal">
          <header className="review-modal__head">
            <div className="review-modal__cover">
              <Cover book={book.data} size="sm" />
            </div>
            <div>
              <p className="eyebrow">Your review</p>
              <h2 id={titleId}>{book.data.title}</h2>
              <p className="review-modal__author">{book.data.author}</p>
            </div>
          </header>
          <div className="review-modal__rate">
            <span className="label">Your rating</span>
            <RateWidget value={stars} onRate={setStars} label="Your rating for this review" />
          </div>
          <label className="field">
            <span className="label">What stayed with you?</span>
            <textarea
              rows={5}
              maxLength={MAX}
              value={text}
              placeholder="The prose, the characters, the pacing. Say it your way."
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="review-modal__tools">
            <span className="muted">
              LitSense reads which aspects you mention and how you feel about each.
            </span>
            <span className="count">
              {text.length} / {MAX}
            </span>
          </div>
          <section className="analysis" aria-live="polite">
            <p className="analysis__title">
              <Icon name="sparkle" size={15} stroke={1.8} />
              <span>What LitSense heard</span>
            </p>
            {!analysis ? (
              <p className="analysis__empty">Save your review and the aspects you mention show up here.</p>
            ) : analysis.status === 'pending' ? (
              <p className="analysis__empty">
                <Spinner label="Analysing" /> Reading your review&hellip;
              </p>
            ) : analysis.status === 'failed' ? (
              <p className="analysis__empty">The analysis did not finish. Saving again will retry it.</p>
            ) : Object.keys(analysis.aspects).length ? (
              <ul className="evidence">
                {Object.entries(analysis.aspects)
                  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                  .map(([a, v]) => (
                    <Tag key={a} kind={v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'neutral'}>
                      {aspectLabel(a)}
                    </Tag>
                  ))}
              </ul>
            ) : (
              <p className="analysis__empty">
                No aspects detected. Try mentioning the characters, the pacing, the prose or the ending.
              </p>
            )}
            {analysis?.status === 'done' && analysis.spoilerSentences > 0 && (
              <p className="analysis__empty">
                {analysis.spoilerSentences} sentence{analysis.spoilerSentences === 1 ? '' : 's'} look like
                spoilers; they are never shown to other readers.
              </p>
            )}
          </section>
          {needsRead && !stars && (
            <label className="check">
              <input type="checkbox" checked={markRead} onChange={(e) => setMarkRead(e.target.checked)} />
              <span>Also mark this book as read</span>
            </label>
          )}
          {save.isError && (
            <p className="form-error" role="alert">
              {errorMessage(save.error)}
            </p>
          )}
          <div className="review-modal__foot">
            {review.data && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(bookId, {
                    onSuccess: () => {
                      toast('Review deleted');
                      onClose();
                    },
                  })
                }
              >
                <Icon name="trash" size={15} />
                <span>Delete review</span>
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!text.trim() || save.isPending}
              onClick={submit}
            >
              <Icon name="check" size={15} stroke={2} />
              <span>{save.isPending ? 'Saving' : review.data ? 'Update review' : 'Save review'}</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
