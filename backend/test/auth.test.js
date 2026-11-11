import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  createAuthRoutes,
  parseCookies,
  requireAuth,
  sanitizeReturnTo,
  SESSION_COOKIE,
  signToken,
  STATE_COOKIE,
  verifyToken,
} from '../src/routes/auth.js';

const TEST_SECRET = 'unit-test-session-secret-key';

describe('auth token and helper functions', () => {
  it('signs and verifies a valid token', () => {
    const now = 1_700_000_000_000;
    const payload = { sub: '123', email: 'alice@tamu.edu', name: 'Alice', exp: now + 60_000 };
    const token = signToken(payload, TEST_SECRET);

    assert.deepEqual(verifyToken(token, TEST_SECRET, now), payload);
  });

  it('rejects expired, tampered, or malformed tokens', () => {
    const now = 1_700_000_000_000;
    const token = signToken({ sub: '123', email: 'alice@tamu.edu', exp: now + 1000 }, TEST_SECRET);

    assert.equal(verifyToken(token, TEST_SECRET, now + 1000), null);
    assert.equal(verifyToken(token, 'wrong-secret', now), null);
    assert.equal(verifyToken(`${token}x`, TEST_SECRET, now), null);
    assert.equal(verifyToken('not-a-valid-token', TEST_SECRET, now), null);
    assert.equal(verifyToken(null, TEST_SECRET, now), null);
  });

  it('sanitizes returnTo paths to prevent open redirects', () => {
    assert.equal(sanitizeReturnTo('/cashier'), '/cashier');
    assert.equal(sanitizeReturnTo('/manager'), '/manager');
    assert.equal(sanitizeReturnTo('https://evil.example/phish'), '/');
    assert.equal(sanitizeReturnTo('//evil.example/phish'), '/');
    assert.equal(sanitizeReturnTo('/\\evil.example'), '/');
    assert.equal(sanitizeReturnTo(''), '/');
    assert.equal(sanitizeReturnTo(undefined, '/cashier'), '/cashier');
  });

  it('parses Cookie headers accurately', () => {
    const parsed = parseCookies('a=1; boba_session=hello%20world; empty=');
    assert.equal(parsed.a, '1');
    assert.equal(parsed.boba_session, 'hello world');
    assert.equal(parsed.empty, '');
    assert.deepEqual(parseCookies(''), {});
  });
});

describe('Google OAuth routes and middleware', () => {
  let server;
  let baseUrl;

  const mockFetch = async (url, options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      const params = new URLSearchParams(options.body);
      if (params.get('code') === 'valid-google-code') {
        return {
          ok: true,
          async json() {
            return { access_token: 'mock-access-token' };
          },
        };
      }
      return { ok: false, status: 400, async json() { return { error: 'invalid_grant' }; } };
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
      if (options.headers?.Authorization === 'Bearer mock-access-token') {
        return {
          ok: true,
          async json() {
            return {
              sub: 'google-uid-42',
              email: 'charlie@tamu.edu',
              name: 'Charlie Manager',
              picture: 'https://example.com/avatar.png',
            };
          },
        };
      }
      return { ok: false, status: 401, async json() { return {}; } };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  before(async () => {
    const app = express();
    app.use(
      '/api/auth',
      createAuthRoutes({
        clientId: 'test-client-id.apps.googleusercontent.com',
        clientSecret: 'test-client-secret',
        secret: TEST_SECRET,
        fetchImpl: mockFetch,
      }),
    );
    app.get('/api/protected', requireAuth(TEST_SECRET), (req, res) => {
      res.json({ user: req.user });
    });
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('reports unauthenticated on GET /api/auth/me and blocks protected routes with 401', async () => {
    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(meRes.status, 200);
    assert.deepEqual(await meRes.json(), {
      authenticated: false,
      configured: true,
      user: null,
    });

    const protRes = await fetch(`${baseUrl}/api/protected`);
    assert.equal(protRes.status, 401);
  });

  it('completes the full Google OAuth redirect, callback, session check, and logout flow', async () => {
    // 1. Start OAuth login for /manager
    const startRes = await fetch(`${baseUrl}/api/auth/google?returnTo=/manager`, {
      redirect: 'manual',
    });
    assert.equal(startRes.status, 302);
    const location = new URL(startRes.headers.get('location'));
    assert.equal(location.origin, 'https://accounts.google.com');
    assert.equal(location.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com');
    const state = location.searchParams.get('state');
    assert.ok(state);

    const setCookies = startRes.headers.getSetCookie();
    const stateCookie = setCookies.find((c) => c.startsWith(`${STATE_COOKIE}=`)).split(';')[0];
    assert.ok(stateCookie);

    // 2. Callback with valid code and matching state
    const cbRes = await fetch(
      `${baseUrl}/api/auth/google/callback?code=valid-google-code&state=${encodeURIComponent(state)}`,
      {
        headers: { Cookie: stateCookie },
        redirect: 'manual',
      },
    );
    assert.equal(cbRes.status, 302);
    assert.equal(cbRes.headers.get('location'), '/manager');

    const cbCookies = cbRes.headers.getSetCookie();
    const sessionCookie = cbCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`)).split(';')[0];
    assert.ok(sessionCookie);

    // 3. Verify GET /api/auth/me and protected endpoint with session cookie
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(meRes.status, 200);
    assert.deepEqual(await meRes.json(), {
      authenticated: true,
      configured: true,
      user: {
        sub: 'google-uid-42',
        email: 'charlie@tamu.edu',
        name: 'Charlie Manager',
        picture: 'https://example.com/avatar.png',
      },
    });

    const protRes = await fetch(`${baseUrl}/api/protected`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(protRes.status, 200);
    const protBody = await protRes.json();
    assert.equal(protBody.user.email, 'charlie@tamu.edu');

    // 4. Logout clears the session cookie
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookie = logoutRes.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    assert.match(logoutCookie, /Max-Age=0/);
  });

  it('rejects callback with mismatched state', async () => {
    const startRes = await fetch(`${baseUrl}/api/auth/google?returnTo=/cashier`, {
      redirect: 'manual',
    });
    const stateCookie = startRes.headers.getSetCookie().find((c) => c.startsWith(`${STATE_COOKIE}=`)).split(';')[0];

    const cbRes = await fetch(
      `${baseUrl}/api/auth/google/callback?code=valid-google-code&state=wrong-state`,
      {
        headers: { Cookie: stateCookie },
        redirect: 'manual',
      },
    );
    assert.equal(cbRes.status, 302);
    assert.equal(cbRes.headers.get('location'), '/cashier?auth_error=invalid_state');
  });
});
