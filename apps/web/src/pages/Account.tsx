import { type FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  useDeleteAccount,
  useGenres,
  useMe,
  useOnboarding,
  useSignOut,
  useTaste,
  useUpdateName,
  useUpdateOverrides,
} from '../api/hooks';
import { errorMessage } from '../api/http';
import { AspectRow, PageHead, Section, SectionHead, Spinner } from '../components/atoms';
import { Icon } from '../components/Icon';
import { Modal } from '../components/overlays';
import { ASPECT_ROWS } from '../lib/evidence';
import { toast } from '../store/ui';

function Toggle({
  on,
  label,
  onChange,
  disabled,
}: {
  on: boolean;
  label: string;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch${on ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const del = useDeleteAccount();
  const navigate = useNavigate();
  const titleId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    del.mutate(password, {
      onSuccess: () => {
        toast('Your account and its data are deleted.');
        navigate('/register', { replace: true });
      },
    });
  };
  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => setOpen(true)}>
        <Icon name="trash" size={15} />
        <span>Delete my account</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <form className="review-modal" onSubmit={submit}>
          <h2 id={titleId}>Delete your account?</h2>
          <p className="muted">
            This removes your ratings, shelves, reviews, conversations and settings for good. It cannot be
            undone.
          </p>
          <label className="field">
            <span className="label">Type your password to confirm</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {del.isError && (
            <p className="form-error" role="alert">
              {errorMessage(del.error)}
            </p>
          )}
          <div className="review-modal__foot">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
              Keep my account
            </button>
            <button
              type="submit"
              className="btn btn--primary btn--sm btn--danger-fill"
              disabled={!password || del.isPending}
            >
              {del.isPending ? 'Deleting' : 'Delete everything'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function AccountPage() {
  const me = useMe();
  const genres = useGenres();
  const onboarding = useOnboarding();
  const taste = useTaste();
  const updateName = useUpdateName();
  const overrides = useUpdateOverrides();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const nameId = useId();

  if (!me.data) return <Spinner />;
  const u = me.data;
  const muted = new Set(u.overrides.mutedGenres);
  const pinned = new Set(u.overrides.pinnedAspects);
  const toggleIn = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return [...next];
  };

  return (
    <div className="page page--account">
      <PageHead
        eyebrow="Reader profile"
        title={
          <>
            Your <em>account</em>
          </>
        }
        sub="Your details, how LitSense reads your taste, and the switches that steer it."
      >
        <div className="profile-card">
          <span className="avatar avatar--xl">{u.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong className="profile-card__name">{u.name}</strong>
            <span className="profile-card__handle">{u.email}</span>
            {u.role === 'admin' && (
              <span className="profile-card__arch">
                <Icon name="shield" size={15} /> Admin
              </span>
            )}
            <span className="profile-card__since">
              Reading since{' '}
              {new Date(u.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </PageHead>

      <Section cls="settings" id="sec-profile">
        <SectionHead no="01" title="Your details" />
        <form
          className="settings__row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name?.trim()) updateName.mutate(name.trim(), { onSuccess: () => toast('Name updated') });
          }}
        >
          <label className="field">
            <span className="label" id={nameId}>
              Display name
            </span>
            <input
              className="input"
              aria-labelledby={nameId}
              value={name ?? u.name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={!name?.trim() || name.trim() === u.name || updateName.isPending}
          >
            Save
          </button>
        </form>
      </Section>

      <Section cls="settings" id="sec-taste">
        <SectionHead
          no="02"
          title="Your taste"
          sub="What you told us at the start, and what we heard in your reviews."
        />
        <div className="settings__grid">
          <div className="aside__block">
            <h3 className="aside__title">From your onboarding</h3>
            {onboarding.data?.displayChips.length ? (
              <ul className="brief">
                {onboarding.data.displayChips.map((c) => (
                  <li key={c} className="brief__tag brief__tag--static">
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="aside__empty">Nothing yet.</p>
            )}
            <Link className="link-arrow settings__link" to="/onboarding">
              <span>Update your picks and taste</span>
              <Icon name="arrow-right" size={15} />
            </Link>
          </div>
          <div className="aside__block">
            <h3 className="aside__title">Heard in your reviews</h3>
            {taste.data?.aspects.length ? (
              <div className="aspects">
                {taste.data.aspects.slice(0, 8).map((a) => (
                  <AspectRow
                    key={a.aspect}
                    label={`${a.polarity >= 0 ? 'Loved' : 'Disliked'}: ${a.label}`}
                    value={Math.round(Math.abs(a.polarity) * 100)}
                    suffix="%"
                  />
                ))}
              </div>
            ) : (
              <p className="aside__empty">
                Write a review or two and the aspects you talk about appear here.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section cls="settings" id="sec-controls">
        <SectionHead
          no="03"
          title="Steer your picks"
          sub="Changes apply to your next page load. They are sent to the recommender as overrides."
        />
        <div className="settings__block">
          <h3 className="label">Mute genres</h3>
          <p className="muted settings__help">Muted genres never appear in your feed or rails.</p>
          <div className="chips">
            {genres.data?.genres.map((g) => (
              <button
                key={g.name}
                type="button"
                className={`chip${muted.has(g.name) ? ' is-active' : ''}`}
                aria-pressed={muted.has(g.name)}
                disabled={overrides.isPending}
                onClick={() => overrides.mutate({ mutedGenres: toggleIn(muted, g.name) })}
              >
                {muted.has(g.name) && <Icon name="eye-off" size={14} />}
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div className="settings__block">
          <h3 className="label">Pin aspects you care about</h3>
          <p className="muted settings__help">Pinned aspects get a boost when books are ranked for you.</p>
          <div className="chips">
            {ASPECT_ROWS.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`chip${pinned.has(a.key) ? ' is-active' : ''}`}
                aria-pressed={pinned.has(a.key)}
                disabled={overrides.isPending}
                onClick={() => overrides.mutate({ pinnedAspects: toggleIn(pinned, a.key) })}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings__block">
          <h3 className="label">AI-written text</h3>
          <Toggle
            on={u.overrides.disabledAi}
            label="Turn off AI-written explanations and chat replies (templates are used instead)"
            disabled={overrides.isPending}
            onChange={(v) => overrides.mutate({ disabledAi: v })}
          />
        </div>
      </Section>

      <Section cls="settings" id="sec-sessions">
        <SectionHead no="04" title="Sessions and data" />
        <div className="settings__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => signOut.mutate(false, { onSettled: () => navigate('/login', { replace: true }) })}
          >
            <Icon name="arrow-left" size={15} />
            <span>Sign out</span>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => signOut.mutate(true, { onSettled: () => navigate('/login', { replace: true }) })}
          >
            <Icon name="users" size={15} />
            <span>Sign out on every device</span>
          </button>
          <DeleteAccount />
        </div>
      </Section>
    </div>
  );
}
