import { Suspense, type ReactNode } from 'react';
import { Link, useRouteError } from 'react-router';
import { Empty, Spinner } from '../components/atoms';
import { RequireAuth } from './guards';

export function Page({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="boot">
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function Authed({
  children,
  allowUnonboarded = false,
}: {
  children: ReactNode;
  allowUnonboarded?: boolean;
}) {
  return (
    <RequireAuth allowUnonboarded={allowUnonboarded}>
      <Page>{children}</Page>
    </RequireAuth>
  );
}

export function RouteError() {
  const err = useRouteError();
  console.error(err);
  return (
    <div className="container">
      <Empty
        icon="compass"
        title="Something went wrong on this page"
        action={
          <a className="btn btn--primary btn--sm" href="/discover">
            Back to Discover
          </a>
        }
      >
        Reload the page; if it keeps happening, try again later.
      </Empty>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container">
      <Empty
        icon="compass"
        title="That page is not in the library"
        action={
          <Link className="btn btn--primary btn--sm" to="/discover">
            Go to Discover
          </Link>
        }
      >
        Head back to Discover.
      </Empty>
    </div>
  );
}
