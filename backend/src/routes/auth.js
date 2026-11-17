import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { asyncRoute, HttpError } from '../http.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export const SESSION_COOKIE = 'boba_session';
export const STATE_COOKIE = 'boba_oauth_state';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours
const STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

const FALLBACK_SECRET = randomBytes(32).toString('hex');

function getSecret(secretOverride) {
  return secretOverride || process.env.SESSION_SECRET || FALLBACK_SECRET;
}

/** Signs a JSON-serializable payload as `base64url(payload).base64url(hmac)`. */
export function signToken(payload, secret = getSecret()) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Verifies a signed token and checks its `exp` timestamp (in ms). Returns null if invalid/expired. */
export function verifyToken(token, secret = getSecret(), now = Date.now()) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null;

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = createHmac('sha256', secret).update(data).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp === 'number' && now >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Parses the HTTP Cookie header into a key-value object. */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (typeof cookieHeader !== 'string' || !cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const rawVal = part.slice(eq + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

/** Ensures returnTo is a safe relative path (prevents open redirects). */
export function sanitizeReturnTo(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  return trimmed;
}

function isSecureRequest(req) {
  const proto = (req.get('x-forwarded-proto') || req.protocol || '').split(',')[0].trim();
  return proto === 'https' || process.env.NODE_ENV === 'production';
}

function serializeCookie(name, value, { maxAge, secure }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res, cookieStr) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

export function resolveCallbackUrl(req, configuredCallbackUrl = process.env.GOOGLE_CALLBACK_URL) {
  if (configuredCallbackUrl && configuredCallbackUrl.trim()) {
    return configuredCallbackUrl.trim();
  }
  const rawHost = req.get('x-forwarded-host') || req.get('host') || 'localhost:3001';
  const host = rawHost.split(',')[0].trim();
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}/api/auth/google/callback`;
}

function buildFrontendRedirect(returnTo, queryParams = {}, frontendOrigin = process.env.FRONTEND_ORIGIN) {
  const safePath = sanitizeReturnTo(returnTo, '/');
  const base = frontendOrigin ? frontendOrigin.replace(/\/+$/, '') : '';
  const url = new URL(safePath, 'http://placeholder.local');
  for (const [k, v] of Object.entries(queryParams)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  return `${base}${url.pathname}${url.search}`;
}

/** Reads the current authenticated user from the request's session cookie, or null. */
export function getUserFromRequest(req, secret = getSecret()) {
  const cookies = parseCookies(req.headers?.cookie);
  const payload = verifyToken(cookies[SESSION_COOKIE], secret);
  if (!payload || !payload.sub || !payload.email) return null;
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}

/** Express middleware that attaches `req.user` if a valid session cookie is present. */
export function attachUser(secret) {
  return (req, _res, next) => {
    req.user = getUserFromRequest(req, secret);
    next();
  };
}

/** Express middleware that requires an authenticated OAuth session. */
export function requireAuth(secret) {
  return (req, _res, next) => {
    const user = req.user ?? getUserFromRequest(req, secret);
    if (!user) {
      next(new HttpError(401, 'Authentication required. Please sign in with Google.'));
      return;
    }
    req.user = user;
    next();
  };
}

export function createAuthRoutes({
  clientId = process.env.GOOGLE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_CLIENT_SECRET,
  callbackUrl = process.env.GOOGLE_CALLBACK_URL,
  frontendOrigin = process.env.FRONTEND_ORIGIN,
  secret = getSecret(),
  fetchImpl = globalThis.fetch,
} = {}) {
  const router = Router();
  const isConfigured = () => Boolean(
    (clientId ?? process.env.GOOGLE_CLIENT_ID)?.trim()
    && (clientSecret ?? process.env.GOOGLE_CLIENT_SECRET)?.trim(),
  );
  const getClientId = () => (clientId ?? process.env.GOOGLE_CLIENT_ID ?? '').trim();
  const getClientSecret = () => (clientSecret ?? process.env.GOOGLE_CLIENT_SECRET ?? '').trim();

  // GET /api/auth/me -> current session status
  router.get('/me', (req, res) => {
    const user = getUserFromRequest(req, secret);
    res.json({
      authenticated: Boolean(user),
      configured: isConfigured(),
      user,
    });
  });

  // GET /api/auth/google?returnTo=/cashier -> redirects to Google OAuth consent screen
  router.get('/google', (req, res) => {
    const returnTo = sanitizeReturnTo(req.query.returnTo, '/');
    if (!isConfigured()) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'not_configured' }, frontendOrigin));
      return;
    }

    const state = randomBytes(16).toString('hex');
    const stateToken = signToken(
      { state, returnTo, exp: Date.now() + STATE_MAX_AGE_SECONDS * 1000 },
      secret,
    );
    const secure = isSecureRequest(req);
    appendSetCookie(res, serializeCookie(STATE_COOKIE, stateToken, { maxAge: STATE_MAX_AGE_SECONDS, secure }));

    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: resolveCallbackUrl(req, callbackUrl),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // GET /api/auth/google/callback -> exchanges code for tokens and establishes session cookie
  router.get('/google/callback', asyncRoute(async (req, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const statePayload = verifyToken(cookies[STATE_COOKIE], secret);
    const secure = isSecureRequest(req);

    // Always clear the one-time state cookie
    appendSetCookie(res, serializeCookie(STATE_COOKIE, '', { maxAge: 0, secure }));

    const returnTo = sanitizeReturnTo(statePayload?.returnTo, '/');

    if (req.query.error) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'access_denied' }, frontendOrigin));
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';

    if (!statePayload || !state || statePayload.state !== state || !code) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'invalid_state' }, frontendOrigin));
      return;
    }

    if (!isConfigured()) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'not_configured' }, frontendOrigin));
      return;
    }

    const tokenRes = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: getClientId(),
        client_secret: getClientSecret(),
        redirect_uri: resolveCallbackUrl(req, callbackUrl),
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'token_exchange_failed' }, frontendOrigin));
      return;
    }

    const tokens = await tokenRes.json();
    if (!tokens?.access_token) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'token_exchange_failed' }, frontendOrigin));
      return;
    }

    const profileRes = await fetchImpl(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'profile_fetch_failed' }, frontendOrigin));
      return;
    }

    const profile = await profileRes.json();
    if (!profile?.sub || !profile?.email) {
      res.redirect(302, buildFrontendRedirect(returnTo, { auth_error: 'invalid_profile' }, frontendOrigin));
      return;
    }

    const now = Date.now();
    const sessionToken = signToken(
      {
        sub: String(profile.sub),
        email: String(profile.email),
        name: String(profile.name || profile.email),
        picture: profile.picture ? String(profile.picture) : null,
        iat: now,
        exp: now + SESSION_MAX_AGE_SECONDS * 1000,
      },
      secret,
    );

    appendSetCookie(
      res,
      serializeCookie(SESSION_COOKIE, sessionToken, { maxAge: SESSION_MAX_AGE_SECONDS, secure }),
    );
    res.redirect(302, buildFrontendRedirect(returnTo, {}, frontendOrigin));
  }));

  // POST /api/auth/logout -> clears session cookie
  router.post('/logout', (req, res) => {
    const secure = isSecureRequest(req);
    appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure }));
    res.json({ ok: true });
  });

  // --- Dev-only login shortcut -------------------------------------------
  // Lets you skip the real Google OAuth flow while developing locally.
  // Hard-disabled in production and OFF unless explicitly enabled, and every
  // use is logged so it can never be mistaken for a real sign-in.
  //
  // Enable with BOTH:
  //   NODE_ENV !== 'production'
  //   DEV_AUTH_BYPASS=true
  //
  // Usage: POST /api/auth/dev-login  { "email": "you@example.com", "name": "Dev User" }
  const devBypassRequested = String(process.env.DEV_AUTH_BYPASS || '').toLowerCase() === 'true';
  const devBypassAllowed = devBypassRequested && process.env.NODE_ENV !== 'production';

  if (devBypassRequested && !devBypassAllowed) {
    // Someone set the flag in what looks like a production environment.
    // Refuse loudly instead of silently ignoring it.
    console.error(
      '[auth] DEV_AUTH_BYPASS is set but NODE_ENV is "production" — refusing to enable it. ' +
      'Remove DEV_AUTH_BYPASS from this environment.',
    );
  }

  if (devBypassAllowed) {
    console.warn(
      '[auth] ⚠️  DEV_AUTH_BYPASS is ENABLED. /api/auth/dev-login will mint sessions ' +
      'without going through Google. Do not set this in staging or production.',
    );

    router.post('/dev-login', (req, res) => {
      const email = typeof req.body?.email === 'string' && req.body.email.trim()
        ? req.body.email.trim()
        : 'dev@localhost';
      const name = typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : email;

      console.warn(`[auth] ⚠️  DEV AUTH BYPASS USED — minting session for "${email}" (no Google verification).`);

      const now = Date.now();
      const sessionToken = signToken(
        {
          sub: `dev:${email}`,
          email,
          name,
          picture: null,
          dev: true,
          iat: now,
          exp: now + SESSION_MAX_AGE_SECONDS * 1000,
        },
        secret,
      );

      const secure = isSecureRequest(req);
      appendSetCookie(
        res,
        serializeCookie(SESSION_COOKIE, sessionToken, { maxAge: SESSION_MAX_AGE_SECONDS, secure }),
      );
      res.json({ ok: true, dev: true, user: { sub: `dev:${email}`, email, name } });
    });
  }
  // -------------------------------------------------------------------------

  return router;
}

export default createAuthRoutes();