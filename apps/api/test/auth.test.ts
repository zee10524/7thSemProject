import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RefreshTokenModel, UserModel } from '../src/models/index.js';
import { API, csrfFor, signUp, useTestApp, wrap } from './helpers.js';

const t = useTestApp({ env: { LOGIN_MAX_FAILURES: '3' } });

function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const line = raw.find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0]?.slice(name.length + 1);
}

describe('auth', () => {
  it('rejects an unsafe request without a CSRF token', async () => {
    const res = await request(t.app)
      .post(`${API}/auth/register`)
      .send({ email: 'x@litsense.test', password: 'password1234', name: 'X' })
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('rejects a CSRF token from a foreign origin', async () => {
    const agent = request.agent(t.app);
    const csrf = await csrfFor(agent);
    const res = await agent
      .post(`${API}/auth/login`)
      .set('X-CSRF-Token', csrf)
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.test', password: 'x' })
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('registers with httpOnly cookies and returns the user', async () => {
    const agent = request.agent(t.app);
    const csrf = await csrfFor(agent);
    const res = await agent
      .post(`${API}/auth/register`)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'Maya@LitSense.test', password: 'correct horse 42', name: 'Maya' })
      .expect(201);
    expect(res.body.user).toMatchObject({ email: 'maya@litsense.test', role: 'user', onboarded: false });
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('ls_at='))).toMatch(/HttpOnly/);
    expect(cookies.find((c) => c.startsWith('ls_rt='))).toMatch(/Path=\/api\/v1\/auth/);
    const stored = await UserModel.findOne({ email: 'maya@litsense.test' }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    await agent.get(`${API}/me`).expect(200);
  });

  it('refuses a duplicate email and a weak password', async () => {
    const s = await signUp(t.app);
    const agent = request.agent(t.app);
    const csrf = await csrfFor(agent);
    const dup = await agent
      .post(`${API}/auth/register`)
      .set('X-CSRF-Token', csrf)
      .send({ email: s.email, password: 'another pass 99', name: 'Y' })
      .expect(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    const weak = await agent
      .post(`${API}/auth/register`)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'weak@litsense.test', password: 'short', name: 'Y' })
      .expect(400);
    expect(weak.body.error.code).toBe('VALIDATION_FAILED');
    expect(weak.body.error.details[0].path).toBe('body.password');
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const s = await signUp(t.app);
    const agent = request.agent(t.app);
    const csrf = await csrfFor(agent);
    const a = await agent
      .post(`${API}/auth/login`)
      .set('X-CSRF-Token', csrf)
      .send({ email: s.email, password: 'wrong pass 1' });
    const b = await agent
      .post(`${API}/auth/login`)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'nobody@litsense.test', password: 'wrong pass 1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('locks the account after repeated failures', async () => {
    const s = await signUp(t.app);
    const agent = request.agent(t.app);
    const csrf = await csrfFor(agent);
    const attempt = (password: string) =>
      agent.post(`${API}/auth/login`).set('X-CSRF-Token', csrf).send({ email: s.email, password });
    await attempt('wrong 1').expect(401);
    await attempt('wrong 2').expect(401);
    const locked = await attempt('wrong 3').expect(423);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(locked.headers['retry-after']).toBeTruthy();
    await attempt(s.password).expect(423); // even the right password, until the lock expires
  });

  it('rotates the refresh token and revokes the family when an old one is replayed', async () => {
    const agent = request.agent(t.app);
    const csrf = await csrfFor(agent);
    const reg = await agent
      .post(`${API}/auth/register`)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'rotate@litsense.test', password: 'correct horse 42', name: 'R' })
      .expect(201);
    const userId = reg.body.user.id as string;
    const rt0 = cookieValue(reg, 'ls_rt');
    const refreshWith = (rt: string | undefined) =>
      request(t.app)
        .post(`${API}/auth/refresh`)
        .set('Cookie', [`ls_rt=${rt}`, `ls_csrf=${csrf}`])
        .set('X-CSRF-Token', csrf);

    const first = await refreshWith(rt0).expect(200);
    const rt1 = cookieValue(first, 'ls_rt');
    expect(rt1).toBeTruthy();
    expect(rt1).not.toBe(rt0);

    // Someone replays the token from before the rotation: the whole family is revoked...
    const replay = await refreshWith(rt0).expect(401);
    expect(replay.body.error.code).toBe('UNAUTHENTICATED');
    // ...so even the legitimate newest token stops working.
    await refreshWith(rt1).expect(401);
    expect(await RefreshTokenModel.countDocuments({ userId, revokedAt: null })).toBe(0);
  });

  it('logs out: refresh no longer works', async () => {
    const s = await signUp(t.app);
    await s.post('/auth/logout').expect(204);
    await s.get('/me').expect(401);
    await s.post('/auth/refresh').expect(401);
  });

  it('accepts a Bearer access token without CSRF (API clients)', async () => {
    const s = await signUp(t.app);
    const token = t.c.tokens.signAccess({ sub: s.userId, role: 'user' });
    await request(t.app)
      .patch(`${API}/me`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bea' })
      .expect(200);
    await request(t.app).get(`${API}/me`).set('Authorization', 'Bearer not-a-jwt').expect(401);
  });

  it('enforces roles on admin routes', async () => {
    const user = await signUp(t.app);
    const forbidden = await user.get('/admin/overview').expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    const admin = await signUp(t.app, { email: 'admin@litsense.test' });
    const ok = await admin.get('/admin/overview').expect(200);
    expect(ok.body).toMatchObject({ modelMode: 'mock', breaker: { state: 'closed' } });
    expect(ok.body.books).toBe(43);
  });

  it('deletes the account only with the right password', async () => {
    const s = await signUp(t.app);
    await s.del('/me', { password: 'not it at all' }).expect(403);
    await s.del('/me', { password: s.password }).expect(204);
    expect(await UserModel.countDocuments({ _id: s.userId })).toBe(0);
    const fresh = wrap(request.agent(t.app), { ...s, csrf: s.csrf });
    await fresh.get('/me').expect(401);
  });
});
