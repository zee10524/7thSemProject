import type { RequestHandler } from 'express';
import {
  AuthResponse,
  CsrfResponse,
  DeleteAccountBody,
  LoginBody,
  RegisterBody,
  UpdateAccountBody,
  UpdateOverridesBody,
  UserDto,
} from '@litsense/shared';
import type { Container } from '../../container.js';
import { clearSessionCookies, issueCsrf, setSessionCookies } from '../cookies.js';
import { COOKIE } from '../context.js';
import { type AnyRoute, defineRoute } from '../route.js';

export function authRoutes(c: Container, authLimiter: RequestHandler): AnyRoute[] {
  const { config, tokens } = c;
  const ua = (h: string | undefined) => h ?? null;
  const refreshCookie = (cookies: unknown) =>
    (cookies as Record<string, string> | undefined)?.[COOKIE.refresh];

  return [
    defineRoute({
      method: 'get',
      path: '/auth/csrf',
      tag: 'Auth',
      summary: 'Get a CSRF token (send it as X-CSRF-Token on every unsafe request)',
      auth: 'public',
      response: CsrfResponse,
      handler: ({ res }) => ({ csrfToken: issueCsrf(res, config, tokens) }),
    }),
    defineRoute({
      method: 'post',
      path: '/auth/register',
      tag: 'Auth',
      summary: 'Create an account and start a session',
      auth: 'public',
      body: RegisterBody,
      response: AuthResponse,
      status: 201,
      middleware: [authLimiter],
      handler: async ({ body, req, res }) => {
        const result = await c.auth.register(body, ua(req.get('user-agent')));
        setSessionCookies(res, config, tokens, result.tokens);
        return { user: result.user, csrfToken: issueCsrf(res, config, tokens) };
      },
    }),
    defineRoute({
      method: 'post',
      path: '/auth/login',
      tag: 'Auth',
      summary: 'Sign in (locks the account after repeated failures)',
      auth: 'public',
      body: LoginBody,
      response: AuthResponse,
      middleware: [authLimiter],
      handler: async ({ body, req, res }) => {
        const result = await c.auth.login(body, ua(req.get('user-agent')));
        setSessionCookies(res, config, tokens, result.tokens);
        return { user: result.user, csrfToken: issueCsrf(res, config, tokens) };
      },
    }),
    defineRoute({
      method: 'post',
      path: '/auth/refresh',
      tag: 'Auth',
      summary: 'Rotate the refresh token and issue a new access token',
      auth: 'public',
      response: AuthResponse,
      handler: async ({ req, res }) => {
        try {
          const result = await c.auth.refresh(refreshCookie(req.cookies), ua(req.get('user-agent')));
          setSessionCookies(res, config, tokens, result.tokens);
          return { user: result.user, csrfToken: issueCsrf(res, config, tokens) };
        } catch (err) {
          clearSessionCookies(res, config);
          throw err;
        }
      },
    }),
    defineRoute({
      method: 'post',
      path: '/auth/logout',
      tag: 'Auth',
      summary: 'End this session',
      auth: 'public',
      handler: async ({ req, res }) => {
        await c.auth.logout(refreshCookie(req.cookies));
        clearSessionCookies(res, config);
      },
    }),
    defineRoute({
      method: 'post',
      path: '/auth/logout-all',
      tag: 'Auth',
      summary: 'End every session of this account',
      auth: 'user',
      handler: async ({ userId, res }) => {
        await c.auth.logoutAll(userId());
        clearSessionCookies(res, config);
      },
    }),

    defineRoute({
      method: 'get',
      path: '/me',
      tag: 'Account',
      summary: 'The signed-in reader',
      auth: 'user',
      response: UserDto,
      handler: ({ userId }) => c.account.me(userId()),
    }),
    defineRoute({
      method: 'patch',
      path: '/me',
      tag: 'Account',
      summary: 'Update the display name',
      auth: 'user',
      body: UpdateAccountBody,
      response: UserDto,
      handler: ({ userId, body }) => c.account.updateName(userId(), body.name),
    }),
    defineRoute({
      method: 'patch',
      path: '/me/overrides',
      tag: 'Account',
      summary: 'Muted genres, pinned aspects and the AI off switch (contract Overrides)',
      auth: 'user',
      body: UpdateOverridesBody,
      response: UserDto,
      handler: ({ userId, body }) => c.account.updateOverrides(userId(), body),
    }),
    defineRoute({
      method: 'delete',
      path: '/me',
      tag: 'Account',
      summary: 'Delete the account and all of its data',
      auth: 'user',
      body: DeleteAccountBody,
      handler: async ({ userId, body, res }) => {
        await c.account.deleteAccount(userId(), body.password);
        clearSessionCookies(res, config);
      },
    }),
  ];
}
