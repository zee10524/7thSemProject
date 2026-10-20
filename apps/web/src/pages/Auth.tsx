import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSignIn } from '../api/hooks';
import { isApiError } from '../api/http';
import { Icon } from '../components/Icon';

function Field({
  label,
  type,
  value,
  onChange,
  error,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="field-error" id={`${id}-err`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function useAfterAuth() {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  return (onboarded: boolean) => {
    const next = params.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/discover';
    navigate(onboarded ? safe : '/onboarding', { replace: true });
  };
}

function AuthShell({ title, sub, children }: { title: ReactNode; sub: string; children: ReactNode }) {
  return (
    <div className="container auth">
      <div className="auth__panel">
        <p className="eyebrow">The Reader&rsquo;s Edition</p>
        <h1 className="auth__title">{title}</h1>
        <p className="page-sub">{sub}</p>
        {children}
      </div>
      <aside className="auth__aside" aria-hidden="true">
        <p className="hand">same rating, different reason</p>
        <ul className="plus-list">
          <li className="plus">
            <span className="plus__icon">
              <Icon name="plus" size={14} stroke={2.4} />
            </span>
            <span>Picks that say why, in plain words</span>
          </li>
          <li className="plus">
            <span className="plus__icon">
              <Icon name="plus" size={14} stroke={2.4} />
            </span>
            <span>Learns what you loved from your reviews</span>
          </li>
          <li className="plus">
            <span className="plus__icon">
              <Icon name="plus" size={14} stroke={2.4} />
            </span>
            <span>Ask for a mood, refine it in conversation</span>
          </li>
        </ul>
      </aside>
    </div>
  );
}

export function LoginPage() {
  const signIn = useSignIn('login');
  const after = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const err = signIn.error;
  const fields = isApiError(err) ? err.fieldErrors() : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn.mutate({ email, password }, { onSuccess: (res) => after(res.user.onboarded) });
  };

  return (
    <AuthShell
      title={
        <>
          Welcome <em>back.</em>
        </>
      }
      sub="Sign in to see today&rsquo;s front page, picked from your shelves."
    >
      <form className="auth__form" onSubmit={submit} noValidate>
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={fields.email}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fields.password}
        />
        {err && !Object.keys(fields).length && (
          <p className="form-error" role="alert">
            {isApiError(err) && err.code === 'ACCOUNT_LOCKED'
              ? 'Too many attempts. This account is locked for a few minutes; try again later.'
              : err.message}
          </p>
        )}
        <button className="btn btn--primary btn--lg" type="submit" disabled={signIn.isPending}>
          <span>{signIn.isPending ? 'Signing in' : 'Sign in'}</span>
          <Icon name="arrow-right" size={18} />
        </button>
        <p className="auth__switch">
          New here?{' '}
          <Link className="link-underline" to="/register">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const signUp = useSignIn('register');
  const after = useAfterAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const err = signUp.error;
  const fields = isApiError(err) ? err.fieldErrors() : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signUp.mutate({ name, email, password }, { onSuccess: (res) => after(res.user.onboarded) });
  };

  return (
    <AuthShell
      title={
        <>
          Start your <em>edition.</em>
        </>
      }
      sub="Two minutes of setup, then a front page of books chosen for you, each with its reasons."
    >
      <form className="auth__form" onSubmit={submit} noValidate>
        <Field
          label="Your name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="given-name"
          error={fields.name}
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={fields.email}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fields.password}
          hint="At least 10 characters, with letters and a number."
        />
        {err && !Object.keys(fields).length && (
          <p className="form-error" role="alert">
            {err.message}
          </p>
        )}
        <button className="btn btn--primary btn--lg" type="submit" disabled={signUp.isPending}>
          <span>{signUp.isPending ? 'Creating your account' : 'Create account'}</span>
          <Icon name="arrow-right" size={18} />
        </button>
        <p className="auth__switch">
          Already reading with us?{' '}
          <Link className="link-underline" to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
