import jwt from 'jsonwebtoken';
import type { Role } from '@litsense/shared';
import { hmac, randomToken, safeEqual, sha256 } from '../lib/hash.js';

export interface AccessClaims {
  sub: string;
  role: Role;
}

const ISSUER = 'litsense-api';
const AUDIENCE = 'litsense-web';

/** Signs and verifies access JWTs, mints refresh tokens and CSRF tokens. */
export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly accessTtlS: number,
    readonly refreshTtlMs: number,
  ) {}

  get accessTtlMs(): number {
    return this.accessTtlS * 1000;
  }

  signAccess(claims: AccessClaims): string {
    return jwt.sign({ role: claims.role }, this.secret, {
      algorithm: 'HS256',
      subject: claims.sub,
      expiresIn: this.accessTtlS,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  }

  verifyAccess(token: string): AccessClaims | null {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'string' || !payload.sub) return null;
      const role = payload.role === 'admin' ? 'admin' : 'user';
      return { sub: payload.sub, role };
    } catch {
      return null;
    }
  }

  newRefreshToken(): { raw: string; hash: string } {
    const raw = randomToken(32);
    return { raw, hash: sha256(raw) };
  }

  hashRefreshToken(raw: string): string {
    return sha256(raw);
  }

  /** CSRF token: `<random>.<hmac(random)>`. The same value goes in an httpOnly cookie and the header. */
  newCsrfToken(): string {
    const nonce = randomToken(18);
    return `${nonce}.${hmac(this.secret, `csrf:${nonce}`)}`;
  }

  isValidCsrfToken(token: string): boolean {
    const [nonce, mac] = token.split('.');
    if (!nonce || !mac) return false;
    return safeEqual(mac, hmac(this.secret, `csrf:${nonce}`));
  }
}
