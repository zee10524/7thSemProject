import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { GuestOnly, RequireAdmin } from './guards';
import { AppLayout, AuthLayout } from './Layout';
import { Authed, NotFound, Page, RouteError } from './routeParts';

// Pages are split into their own chunks and load on first visit.
const Login = lazy(() => import('../pages/Auth').then((m) => ({ default: m.LoginPage })));
const Register = lazy(() => import('../pages/Auth').then((m) => ({ default: m.RegisterPage })));
const Onboarding = lazy(() => import('../pages/Onboarding'));
const Discover = lazy(() => import('../pages/Discover'));
const MyBooks = lazy(() => import('../pages/MyBooks'));
const Recommendations = lazy(() => import('../pages/Recommendations'));
const RecentReads = lazy(() => import('../pages/RecentReads'));
const Chat = lazy(() => import('../pages/Chat'));
const Book = lazy(() => import('../pages/Book'));
const Search = lazy(() => import('../pages/Search'));
const Account = lazy(() => import('../pages/Account'));
const Admin = lazy(() => import('../pages/Admin'));

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/login',
        element: (
          <GuestOnly>
            <Page>
              <Login />
            </Page>
          </GuestOnly>
        ),
      },
      {
        path: '/register',
        element: (
          <GuestOnly>
            <Page>
              <Register />
            </Page>
          </GuestOnly>
        ),
      },
      {
        path: '/onboarding',
        element: (
          <Authed allowUnonboarded>
            <Onboarding />
          </Authed>
        ),
      },
    ],
  },
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Navigate to="/discover" replace /> },
      {
        path: '/discover',
        element: (
          <Authed>
            <Discover />
          </Authed>
        ),
      },
      {
        path: '/my-books',
        element: (
          <Authed>
            <MyBooks />
          </Authed>
        ),
      },
      {
        path: '/recommendations',
        element: (
          <Authed>
            <Recommendations />
          </Authed>
        ),
      },
      // Optional segments keep one page instance, so state survives /chat -> /chat/:id.
      {
        path: '/recent/:bookId?',
        element: (
          <Authed>
            <RecentReads />
          </Authed>
        ),
      },
      {
        path: '/chat/:sessionId?',
        element: (
          <Authed>
            <Chat />
          </Authed>
        ),
      },
      {
        path: '/book/:bookId',
        element: (
          <Authed>
            <Book />
          </Authed>
        ),
      },
      {
        path: '/search',
        element: (
          <Authed>
            <Search />
          </Authed>
        ),
      },
      {
        path: '/account',
        element: (
          <Authed allowUnonboarded>
            <Account />
          </Authed>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <Page>
              <Admin />
            </Page>
          </RequireAdmin>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
