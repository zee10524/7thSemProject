import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../api/hooks';
import { ErrorState, Spinner } from '../components/atoms';

function Boot() {
  return (
    <div className="boot" aria-busy="true">
      <Spinner label="Opening your shelves" />
    </div>
  );
}

/** Signed-in only. New readers go to onboarding first (they can skip it there). */
export function RequireAuth({
  children,
  allowUnonboarded = false,
}: {
  children: ReactNode;
  allowUnonboarded?: boolean;
}) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) return <Boot />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!me.data.onboarded && !allowUnonboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <Boot />;
  if (me.data?.role !== 'admin') return <Navigate to="/discover" replace />;
  return <>{children}</>;
}

/** Sign-in pages bounce a signed-in reader to where they were going. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  const params = new URLSearchParams(useLocation().search);
  if (me.isPending) return <Boot />;
  if (me.data) {
    const next = params.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/discover';
    return <Navigate to={me.data.onboarded ? safe : '/onboarding'} replace />;
  }
  return <>{children}</>;
}
