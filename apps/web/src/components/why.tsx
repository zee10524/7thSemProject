import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { BookDto, Evidence } from '@litsense/shared';
import { useExplanation } from '../api/hooks';
import { errorMessage } from '../api/http';
import { aspectLabel, parseEvidence, sourceLabel, topAspects } from '../lib/evidence';
import { AspectRow, Spinner, Tag } from './atoms';
import { Icon } from './Icon';
import { Modal } from './overlays';

/** Positive and negative aspect tags from the evidence (what the reader values, where it may miss). */
export function EvidenceTags({ evidence, max = 4 }: { evidence: Evidence; max?: number }) {
  const ev = parseEvidence(evidence);
  const tags = [
    ...ev.positives.map((p) => ({ kind: 'pos' as const, label: p.label })),
    ...(ev.favoriteAuthor ? [{ kind: 'pos' as const, label: `by ${ev.favoriteAuthor}` }] : []),
    ...ev.negatives.map((n) => ({ kind: 'neg' as const, label: n.label })),
  ].slice(0, max);
  if (!tags.length) return null;
  return (
    <ul className="evidence">
      {tags.map((t) => (
        <Tag key={`${t.kind}-${t.label}`} kind={t.kind}>
          {t.label}
        </Tag>
      ))}
    </ul>
  );
}

export function AspectChart({ evidence, n = 4 }: { evidence: Evidence; n?: number }) {
  const rows = topAspects(parseEvidence(evidence), n);
  if (!rows.length) return null;
  return (
    <div className="aspects">
      {rows.map((r) => (
        <AspectRow key={r.key} label={r.label} value={r.value} suffix="%" />
      ))}
    </div>
  );
}

/** The card's "Why this book?" block: the one-sentence reason plus a button to the full evidence. */
export function Why({
  book,
  reason,
  evidence,
  label = 'Why this book?',
}: {
  book: BookDto;
  reason: string;
  evidence: Evidence;
  label?: string;
}) {
  return (
    <div className="why">
      <span className="why__label">{label}</span>
      <p className="why__text">{reason}</p>
      <EvidenceTags evidence={evidence} />
      <WhyButton book={book} reason={reason} evidence={evidence} />
    </div>
  );
}

export function WhyButton({
  book,
  reason,
  evidence,
  className,
}: {
  book: BookDto;
  reason: string;
  evidence: Evidence;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? 'why__more link-underline'} onClick={() => setOpen(true)}>
        <Icon name="sparkle" size={14} stroke={1.8} />
        <span>Explain this pick</span>
      </button>
      {open && (
        <EvidenceDrawer book={book} reason={reason} evidence={evidence} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** Everything behind a pick: the explanation (LLM or template), the signals and the review evidence. */
export function EvidenceDrawer({
  book,
  reason,
  evidence,
  onClose,
}: {
  book: BookDto;
  reason: string;
  evidence: Evidence;
  onClose: () => void;
}) {
  const titleId = useId();
  const exp = useExplanation(book.bookId, true);
  const ev = parseEvidence(exp.data?.evidence ?? evidence);
  const aspects = topAspects(ev, 6);
  return (
    <Modal open onClose={onClose} labelledBy={titleId} className="modal__panel--why">
      <div className="drawer">
        <p className="eyebrow">Why LitSense picked it</p>
        <h2 id={titleId} className="drawer__title">
          {book.title}
        </h2>
        <p className="drawer__reason">{reason}</p>

        <section className="explain" aria-live="polite">
          <p className="analysis__title">
            <Icon name="sparkle" size={15} stroke={1.8} />
            <span>In plain words</span>
            {exp.data && (
              <span className="method-badge">
                {exp.data.method === 'llm' ? 'written by AI, checked' : 'template'}
              </span>
            )}
          </p>
          {exp.isPending ? (
            <Spinner label="Writing the explanation" />
          ) : exp.isError ? (
            <p className="analysis__empty">{errorMessage(exp.error)}</p>
          ) : (
            <p className="explain__text">{exp.data?.text}</p>
          )}
        </section>

        <div className="drawer__cols">
          <div>
            <span className="label">What it matches</span>
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
              {ev.favoriteAuthor && (
                <li className="plus">
                  <span className="plus__icon">
                    <Icon name="plus" size={14} stroke={2.4} />
                  </span>
                  <span className="plus__text">You rated {ev.favoriteAuthor} highly</span>
                </li>
              )}
              {ev.similarLiked.map((s) => (
                <li key={s.bookId} className="plus">
                  <span className="plus__icon">
                    <Icon name="plus" size={14} stroke={2.4} />
                  </span>
                  <span className="plus__text">
                    Close to <Link to={`/book/${s.bookId}`}>{s.title}</Link>, which you gave {s.stars} stars
                  </span>
                </li>
              ))}
              {!ev.positives.length && !ev.favoriteAuthor && !ev.similarLiked.length && (
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
            <span className="label drawer__label">Where it came from</span>
            <ul className="drawer__sources">
              {ev.sources.map((s) => (
                <li key={s}>{sourceLabel(s)}</li>
              ))}
              {ev.rankedBy && (
                <li>Ranked by the {ev.rankedBy === 'ranker' ? 'learned ranker' : 'fallback blend'}</li>
              )}
            </ul>
          </div>
          <div>
            {aspects.length > 0 && (
              <>
                <span className="label">What reviewers praise</span>
                <div className="aspects">
                  {aspects.map((a) => (
                    <AspectRow key={a.key} label={a.label} value={a.value} suffix="%" />
                  ))}
                </div>
              </>
            )}
            {ev.snippet && (
              <blockquote className="drawer__snippet">
                &ldquo;{ev.snippet.text}&rdquo;
                <cite>a reader on its {aspectLabel(ev.snippet.aspect)}</cite>
              </blockquote>
            )}
          </div>
        </div>
        <p className="spoiler-note">
          <Icon name="shield" size={14} />
          <span>
            Spoiler-safe. The recommender chose the book; the words only explain it and cannot name other
            books.
          </span>
        </p>
      </div>
    </Modal>
  );
}
