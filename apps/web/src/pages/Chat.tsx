import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { AssistantTurnDto, ChatItemDto, ChatSessionDto, Chip } from '@litsense/shared';
import {
  useChatSession,
  useChatSessions,
  useCreateChat,
  useDeleteChat,
  useRemoveChip,
  useSendChat,
} from '../api/chatHooks';
import { useMe } from '../api/hooks';
import { errorMessage } from '../api/http';
import { Cover, ErrorState, RankBadge, Stars } from '../components/atoms';
import { bookHref, CHAT_STARTERS } from '../lib/links';
import { Icon } from '../components/Icon';
import { ShelfControl } from '../components/shelf';
import { EvidenceTags } from '../components/why';
import { ago } from '../lib/format';
import { toast } from '../store/ui';

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];
const REFINE = [
  'Make it cozier',
  'Make it shorter',
  'More emotional',
  'Darker',
  'Why the first one?',
  'Something else',
];
const STARTERS = [
  'I want something like Project Hail Mary, but shorter and more character-driven.',
  'Something cozy for a rainy weekend',
  'A short book I can finish tonight',
];

function ChatCard({
  item,
  index,
  onAsk,
}: {
  item: ChatItemDto;
  index: number;
  onAsk: (msg: string) => void;
}) {
  const b = item.book;
  return (
    <article className="chat-card">
      <Link className="chat-card__cover" to={bookHref(b)} aria-label={`Open ${b.title}`}>
        <Cover book={b} size="md" />
      </Link>
      <div className="chat-card__body">
        <div className="chat-card__head">
          <div>
            <h3 className="chat-card__title">
              <Link to={bookHref(b)}>{b.title}</Link>
            </h3>
            <p className="chat-card__author">
              {b.author}
              {b.pages ? ` · ${b.pages} pages` : ''}
              {b.year ? ` · ${b.year}` : ''}
            </p>
            {b.avgRating !== null && (
              <p className="chat-card__rating">
                <Stars value={b.avgRating} />
                <b>{b.avgRating.toFixed(1)}</b>
              </p>
            )}
          </div>
          <RankBadge rank={index + 1} variant="md" />
        </div>
        <p className="chat-card__why">{item.reason}</p>
        <EvidenceTags evidence={item.evidence} max={3} />
        <div className="chat-card__actions">
          <ShelfControl book={b} short />
          {index < ORDINALS.length && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onAsk(`Why the ${ORDINALS[index]} one?`)}
            >
              <Icon name="sparkle" size={14} stroke={1.8} />
              <span>Why this one?</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Words({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  return (
    <>
      {text.split(/(\s+)/).map((tok, i) =>
        /^\s+$/.test(tok) ? (
          tok
        ) : (
          <span key={i} className="w" style={{ '--n': Math.min(i / 2, 70) } as CSSProperties}>
            {tok}
          </span>
        ),
      )}
    </>
  );
}

function AssistantMessage({
  turn,
  fresh,
  onAsk,
  busy,
}: {
  turn: AssistantTurnDto;
  fresh: boolean;
  onAsk: (m: string) => void;
  busy: boolean;
}) {
  const words = turn.intro.split(/\s+/).length;
  return (
    <div
      className={`msg msg--ai${fresh ? ' msg--new' : ''}`}
      style={{ '--card-delay': `${(words * 0.038 + 0.25).toFixed(2)}s` } as CSSProperties}
    >
      <span className="msg__avatar" aria-hidden="true">
        <Icon name="sparkle" size={16} stroke={1.8} />
      </span>
      <div className="msg__body">
        <div className="msg__bubble">
          <span className="msg__who">LitSense</span>
          <p className="msg__text">
            <Words text={turn.intro} animate={fresh} />
          </p>
          {turn.method === 'llm' && <span className="method-badge">written by AI from the picks</span>}
        </div>
        {turn.items.map((item, i) => (
          <ChatCard
            key={item.book.bookId}
            item={item}
            index={turn.intent === 'explain_recommendation' ? 0 : i}
            onAsk={onAsk}
          />
        ))}
        {turn.clarification && (
          <div className="clarify" role="group" aria-label={turn.clarification.question}>
            <p className="clarify__q">{turn.clarification.question}</p>
            <div className="chips">
              {turn.clarification.options.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  className="chip"
                  disabled={busy}
                  onClick={() => onAsk(String(o.value))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {turn.followup && <p className="msg__followup">{turn.followup}</p>}
      </div>
    </div>
  );
}

function Aside({
  session,
  onRemoveChip,
  removing,
}: {
  session: ChatSessionDto | undefined;
  onRemoveChip: (chip: Chip) => void;
  removing: boolean;
}) {
  const sessions = useChatSessions();
  const del = useDeleteChat();
  const navigate = useNavigate();
  const path = (session?.turns ?? []).flatMap((t) =>
    t.role === 'assistant' && t.items[0] && t.intent !== 'explain_recommendation'
      ? [{ id: t.id, item: t.items[0], note: t.intro }]
      : [],
  );
  return (
    <aside className="chat__aside">
      <section className="aside__block">
        <h2 className="aside__title">Your brief</h2>
        {session?.chips.length ? (
          <ul className="brief">
            {session.chips.map((c) => (
              <li key={`${c.key}-${c.label}`} className="brief__tag">
                <span>{c.label}</span>
                <button
                  type="button"
                  className="brief__drop"
                  aria-label={`Remove ${c.label}`}
                  disabled={removing}
                  onClick={() => onRemoveChip(c)}
                >
                  <Icon name="x" size={13} stroke={2.4} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="aside__empty">
            Nothing yet. Say what you want and your brief builds here, one refinement at a time.
          </p>
        )}
      </section>
      <section className="aside__block">
        <h2 className="aside__title">Refinement path</h2>
        {path.length ? (
          <ol className="path">
            {path.map((p) => (
              <li key={p.id} className="path__item">
                <span className="path__thumb">
                  <Cover book={p.item.book} size="xs" />
                </span>
                <span className="path__text">
                  <strong>{p.item.book.title}</strong>
                  <small>{p.note}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="aside__empty">Your picks appear here, in the order you refined them.</p>
        )}
      </section>
      <section className="aside__block">
        <h2 className="aside__title">Conversations</h2>
        <button type="button" className="btn btn--ghost btn--sm aside__new" onClick={() => navigate('/chat')}>
          <Icon name="plus" size={15} stroke={2} />
          <span>New conversation</span>
        </button>
        <ul className="convos">
          {sessions.data?.items.map((s) => (
            <li key={s.id} className={s.id === session?.id ? 'is-active' : undefined}>
              <Link to={`/chat/${s.id}`}>
                <strong>{s.title}</strong>
                <small>{ago(s.updatedAt)}</small>
              </Link>
              {s.id === session?.id && (
                <button
                  type="button"
                  className="brief__drop"
                  aria-label="Delete this conversation"
                  onClick={() => del.mutate(s.id, { onSuccess: () => navigate('/chat', { replace: true }) })}
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="aside__block aside__block--note">
        <h2 className="aside__title">How it works</h2>
        <p>
          The recommender decides <strong>what</strong> to suggest. The language layer only decides{' '}
          <strong>how</strong> to say it. Every pick is grounded in your shelves and reader reviews.
        </p>
      </section>
    </aside>
  );
}

export default function ChatPage() {
  const { sessionId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const session = useChatSession(sessionId);
  const create = useCreateChat();
  const send = useSendChat(sessionId);
  const removeChip = useRemoveChip();
  const [input, setInput] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const seenBySession = useRef(new Map<string, Set<string>>());
  const createdHere = useRef(new Set<string>());
  const autoSent = useRef(false);

  const turns = useMemo(() => session.data?.turns ?? [], [session.data]);
  // Turns already there when a conversation is opened do not animate; replies that arrive now do.
  if (session.data && !seenBySession.current.has(session.data.id)) {
    seenBySession.current.set(
      session.data.id,
      createdHere.current.has(session.data.id) ? new Set() : new Set(session.data.turns.map((t) => t.id)),
    );
  }
  const seen = { current: session.data ? seenBySession.current.get(session.data.id) : undefined };

  const busy = send.isPending || create.isPending || removeChip.isPending;
  const last = [...turns].reverse().find((t): t is AssistantTurnDto => t.role === 'assistant');
  const suggestions = last?.items.length ? REFINE : CHAT_STARTERS;

  const ask = async (message: string) => {
    const text = message.trim();
    if (!text || busy) return;
    setInput('');
    try {
      let id = sessionId;
      if (!id) {
        const created = await create.mutateAsync();
        id = created.id;
        createdHere.current.add(id);
        navigate(`/chat/${id}`, { replace: true });
      }
      await send.mutateAsync({ id, message: text });
    } catch (err) {
      toast(errorMessage(err), { kind: 'warn' });
    }
  };

  useEffect(() => {
    const prompt = params.get('prompt');
    if (!prompt || autoSent.current) return;
    autoSent.current = true;
    setParams({}, { replace: true });
    void ask(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the ?prompt= deep link
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns.length, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <div className="page page--chat">
      <div className="container container--chat">
        <header className="chat__head">
          <p className="eyebrow">Your reading concierge</p>
          <h1 className="page-title">
            Ask <em>LitSense</em>
          </h1>
          <p className="page-sub">Tell me what you&rsquo;re in the mood to read.</p>
        </header>
        <div className="chat">
          <div className="chat__main">
            <div
              className="chat__scroll"
              ref={scroller}
              role="log"
              aria-live="polite"
              aria-label="Conversation with LitSense"
            >
              {sessionId && session.isError ? (
                <ErrorState error={session.error} onRetry={() => void session.refetch()} />
              ) : (
                <>
                  <div className="msg msg--ai">
                    <span className="msg__avatar" aria-hidden="true">
                      <Icon name="sparkle" size={16} stroke={1.8} />
                    </span>
                    <div className="msg__body">
                      <div className="msg__bubble">
                        <span className="msg__who">LitSense</span>
                        <p className="msg__text">
                          Welcome back{me.data ? `, ${me.data.name}` : ''}. Tell me what you are in the mood
                          to read, or name a book you loved and I will look for its echoes.
                        </p>
                      </div>
                      {!turns.length && !busy && (
                        <div className="starters">
                          {STARTERS.map((t, i) => (
                            <button key={t} type="button" className="starter" onClick={() => void ask(t)}>
                              <span className="starter__no">0{i + 1}</span>
                              <span>{t}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {turns.map((t) =>
                    t.role === 'user' ? (
                      <div
                        key={t.id}
                        className={`msg msg--user${seen.current?.has(t.id) ? '' : ' msg--new'}`}
                      >
                        <div className="msg__bubble">
                          <span className="msg__who">You</span>
                          <p className="msg__text">{t.text}</p>
                        </div>
                      </div>
                    ) : (
                      <AssistantMessage
                        key={t.id}
                        turn={t}
                        fresh={!seen.current?.has(t.id)}
                        onAsk={(m) => void ask(m)}
                        busy={busy}
                      />
                    ),
                  )}
                  {busy && (
                    <div className="msg msg--ai msg--typing">
                      <span className="msg__avatar" aria-hidden="true">
                        <Icon name="sparkle" size={16} stroke={1.8} />
                      </span>
                      <div className="msg__body">
                        <div className="msg__bubble typing" role="status" aria-label="LitSense is thinking">
                          <span className="typing__dots">
                            <i />
                            <i />
                            <i />
                          </span>
                          <span className="typing__text">Reading your shelves</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="chat__dock">
              <div className="chat__chips">
                {suggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip chip--suggest"
                    disabled={busy}
                    onClick={() => void ask(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <form className={`composer${busy ? ' is-busy' : ''}`} onSubmit={submit} autoComplete="off">
                <label className="sr-only" htmlFor="chatInput">
                  Message LitSense
                </label>
                <input
                  id="chatInput"
                  className="composer__input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe a mood, a book you loved, or a length"
                  maxLength={500}
                  enterKeyHint="send"
                />
                <button
                  className="composer__send"
                  type="submit"
                  aria-label="Send message"
                  disabled={busy || !input.trim()}
                >
                  <Icon name="send" size={20} />
                </button>
              </form>
              <p className="chat__foot">
                <Icon name="shield" size={13} />
                <span>
                  Picks come from the recommendation engine. The assistant only explains them, so it cannot
                  invent books.
                </span>
              </p>
            </div>
          </div>
          <Aside
            session={session.data}
            removing={removeChip.isPending}
            onRemoveChip={(chip) => sessionId && removeChip.mutate({ id: sessionId, key: chip.key })}
          />
        </div>
      </div>
    </div>
  );
}
