import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { SessionTokens } from '../services/auth.service.js';
import type { TokenService } from '../services/token.service.js';
import { API_PREFIX, COOKIE } from './context.js';

function base(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.COOKIE_SAMESITE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookies(
  res: Response,
  config: AppConfig,
  tokens: TokenService,
  session: SessionTokens,
): void {
  res.cookie(COOKIE.access, session.accessToken, { ...base(config), path: '/', maxAge: tokens.accessTtlMs });
  res.cookie(COOKIE.refresh, session.refreshToken, {
    ...base(config),
    path: `${API_PREFIX}/auth`,
    maxAge: tokens.refreshTtlMs,
  });
}

export function clearSessionCookies(res: Response, config: AppConfig): void {
  res.clearCookie(COOKIE.access, { ...base(config), path: '/' });
  res.clearCookie(COOKIE.refresh, { ...base(config), path: `${API_PREFIX}/auth` });
}

/** Issues a fresh CSRF token: httpOnly cookie copy plus the value the SPA keeps in memory. */
export function issueCsrf(res: Response, config: AppConfig, tokens: TokenService): string {
  const token = tokens.newCsrfToken();
  res.cookie(COOKIE.csrf, token, { ...base(config), path: '/', maxAge: tokens.refreshTtlMs });
  return token;
}
