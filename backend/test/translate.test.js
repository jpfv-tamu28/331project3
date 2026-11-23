import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import {
  LANGUAGES, SOURCE_LANGUAGE, createTranslateRoutes, decodeEntities, splitForMyMemory,
} from '../src/routes/translate.js';

function startTestApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api/translate', router);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

describe('translate helpers', () => {
  it('decodes named, decimal, and hex HTML entities in one pass', () => {
    assert.equal(decodeEntities('Milk &amp; Tea &lt;3&#39; &quot;hi&quot; &#x27;ok&#x27; &apos;yes&apos;'), 'Milk & Tea <3\' "hi" \'ok\' \'yes\'');
    assert.equal(decodeEntities('&amp;lt;'), '&lt;');
  });

  it('splits strings exceeding maxBytes while keeping every segment within the UTF-8 byte limit', () => {
    const longText = Array.from({ length: 20 }, (_, i) => `Sentence number ${i + 1} with café notes.`).join(' ');
    const parts = splitForMyMemory(longText, 120);
    assert.ok(parts.length > 1);
    for (const part of parts) {
      assert.ok(Buffer.byteLength(part, 'utf8') <= 120);
    }

    const multibyteToken = '茶'.repeat(200);
    const tokenParts = splitForMyMemory(multibyteToken, 45);
    assert.ok(tokenParts.length > 1);
    assert.equal(tokenParts.join(''), multibyteToken);
    for (const part of tokenParts) {
      assert.ok(Buffer.byteLength(part, 'utf8') <= 45);
    }
  });
});

describe('translate HTTP routes (MyMemory default)', () => {
  let server;
  let baseUrl;
  let fetchCalls;
  let nextBehavior;
  let cache;

  before(async () => {
    fetchCalls = [];
    nextBehavior = null;
    cache = new Map();

    const fakeFetch = async (url, init) => {
      fetchCalls.push({ url, init });
      if (nextBehavior) {
        const result = await nextBehavior(url, init);
        if (result) return result;
      }
      const parsed = new URL(url);
      const q = parsed.searchParams.get('q');
      const [, target] = (parsed.searchParams.get('langpair') || '').split('|');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          quotaFinished: false,
          responseData: { translatedText: `[${target}] ${q} &amp; more` },
        }),
      };
    };

    ({ server, baseUrl } = await startTestApp(createTranslateRoutes({
      fetchImpl: fakeFetch, env: {}, cache, bundled: new Map(),
    })));
  });

  after(() => server.close());

  it('lists supported languages on GET /api/translate/languages', async () => {
    const res = await fetch(`${baseUrl}/api/translate/languages`);
    assert.equal(res.status, 200);
    const list = await res.json();
    const en = list.find((l) => l.code === SOURCE_LANGUAGE);
    assert.ok(en);
    assert.deepEqual(en.targets, LANGUAGES.map((l) => l.code));
    assert.equal(list.length, LANGUAGES.length + 1);
  });

  it('translates batches, decodes entities, skips letterless strings, and caches results', async () => {
    fetchCalls = [];
    const res = await fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: ['Milk Tea', '$5.50', '   ', 'Milk Tea', 'Add to Order'],
        source: 'en',
        target: 'es',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.translatedText, [
      '[es] Milk Tea & more',
      '$5.50',
      '   ',
      '[es] Milk Tea & more',
      '[es] Add to Order & more',
    ]);
    // Only 2 unique translatable strings ("Milk Tea", "Add to Order") were sent upstream.
    assert.equal(fetchCalls.length, 2);

    // Repeating the same strings hits the server cache with 0 upstream requests.
    const res2 = await fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'Milk Tea', target: 'es' }),
    });
    assert.equal(res2.status, 200);
    assert.deepEqual(await res2.json(), { translatedText: '[es] Milk Tea & more' });
    assert.equal(fetchCalls.length, 2);
  });

  it('coalesces concurrent in-flight requests for the same string', async () => {
    fetchCalls = [];
    let release;
    const gate = new Promise((r) => { release = r; });
    nextBehavior = async (url) => {
      await gate;
      const q = new URL(url).searchParams.get('q');
      return {
        ok: true,
        status: 200,
        json: async () => ({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: `fr:${q}` } }),
      };
    };

    const req1 = fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: ['Taro Boba'], target: 'fr' }),
    });
    const req2 = fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: ['Taro Boba', 'Green Tea'], target: 'fr' }),
    });

    await new Promise((r) => setTimeout(r, 20));
    release();
    const [r1, r2] = await Promise.all([req1, req2]);
    nextBehavior = null;

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.deepEqual(await r1.json(), { translatedText: ['fr:Taro Boba'] });
    assert.deepEqual(await r2.json(), { translatedText: ['fr:Taro Boba', 'fr:Green Tea'] });
    assert.equal(fetchCalls.length, 2);
  });

  it('returns target === source unchanged without upstream requests', async () => {
    fetchCalls = [];
    const res = await fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: ['Hello'], source: 'en', target: 'en' }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { translatedText: ['Hello'] });
    assert.equal(fetchCalls.length, 0);
  });

  it('validates input and returns 400 for invalid target, source, or q', async () => {
    for (const payload of [
      { q: ['Hi'], target: 'xx' },
      { q: [], target: 'es' },
      { q: [123], target: 'es' },
      { q: ['Hi'], source: 'fr', target: 'es' },
    ]) {
      const res = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400);
    }
  });

  it('returns 502 on MyMemory quota/warning responses and does not cache the failure', async () => {
    fetchCalls = [];
    nextBehavior = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        responseStatus: 200,
        quotaFinished: true,
        responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' },
      }),
    });

    const failRes = await fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: ['Quota Test'], target: 'de' }),
    });
    assert.equal(failRes.status, 502);
    assert.equal(cache.has('de\0Quota Test'), false);

    nextBehavior = null;
    const okRes = await fetch(`${baseUrl}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: ['Quota Test'], target: 'de' }),
    });
    assert.equal(okRes.status, 200);
    assert.deepEqual(await okRes.json(), { translatedText: ['[de] Quota Test & more'] });
  });
});

describe('translate provider priority and fallback', () => {
  it('falls back to MyMemory when Google and LibreTranslate fail', async () => {
    const calledUrls = [];
    const fakeFetch = async (url) => {
      calledUrls.push(url);
      if (url.startsWith('https://translation.googleapis.com/')) {
        return { ok: false, status: 403, json: async () => ({}) };
      }
      if (url.startsWith('http://localhost:5000/')) {
        throw new Error('ECONNREFUSED');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          responseStatus: 200,
          quotaFinished: false,
          responseData: { translatedText: 'Té Matcha' },
        }),
      };
    };

    const { server, baseUrl } = await startTestApp(createTranslateRoutes({
      fetchImpl: fakeFetch,
      bundled: new Map(),
      env: {
        GOOGLE_TRANSLATE_API_KEY: 'test-google-key',
        LIBRETRANSLATE_URL: 'http://localhost:5000',
        MYMEMORY_EMAIL: 'team@example.com',
      },
    }));

    try {
      const res = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: ['Matcha Tea'], target: 'es' }),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { translatedText: ['Té Matcha'] });
      assert.equal(calledUrls.length, 3);
      assert.ok(calledUrls[0].startsWith('https://translation.googleapis.com/'));
      assert.equal(calledUrls[1], 'http://localhost:5000/translate');
      assert.ok(calledUrls[2].includes('de=team%40example.com'));
    } finally {
      server.close();
    }
  });

  it('uses Google Cloud Translate v2 first when configured and healthy, and maps zh-CN for LibreTranslate', async () => {
    const googleApp = await startTestApp(createTranslateRoutes({
      env: { GOOGLE_TRANSLATE_API_KEY: 'gk' },
      bundled: new Map(),
      fetchImpl: async (url, init) => {
        assert.ok(url.startsWith('https://translation.googleapis.com/language/translate/v2?key=gk'));
        const body = JSON.parse(init.body);
        assert.deepEqual(body.q, ['Tea & Ice']);
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { translations: [{ translatedText: 'Té &amp; Hielo' }] } }),
        };
      },
    }));

    const ltApp = await startTestApp(createTranslateRoutes({
      env: { LIBRETRANSLATE_URL: 'http://lt.local:5000/' },
      bundled: new Map(),
      fetchImpl: async (url, init) => {
        assert.equal(url, 'http://lt.local:5000/translate');
        const body = JSON.parse(init.body);
        assert.equal(body.target, 'zh');
        return {
          ok: true,
          status: 200,
          json: async () => ({ translatedText: ['奶茶'] }),
        };
      },
    }));

    try {
      const gRes = await fetch(`${googleApp.baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: ['Tea & Ice'], target: 'es' }),
      });
      assert.equal(gRes.status, 200);
      assert.deepEqual(await gRes.json(), { translatedText: ['Té & Hielo'] });

      const ltRes = await fetch(`${ltApp.baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: ['Milk Tea'], target: 'zh-CN' }),
      });
      assert.equal(ltRes.status, 200);
      assert.deepEqual(await ltRes.json(), { translatedText: ['奶茶'] });
    } finally {
      googleApp.server.close();
      ltApp.server.close();
    }
  });
});

describe('bundled kiosk translations', () => {
  it('covers every supported language with identical keys and non-empty strings', () => {
    const bundle = JSON.parse(readFileSync(new URL('../../shared/kioskTranslations.json', import.meta.url), 'utf8'));
    const expectedLangs = LANGUAGES.map((l) => l.code).sort();
    assert.deepEqual(Object.keys(bundle).sort(), expectedLangs);

    const referenceKeys = Object.keys(bundle[expectedLangs[0]]).sort();
    assert.ok(referenceKeys.length > 50);
    for (const lang of expectedLangs) {
      assert.deepEqual(Object.keys(bundle[lang]).sort(), referenceKeys, `Key mismatch for ${lang}`);
      for (const k of referenceKeys) {
        assert.equal(typeof bundle[lang][k], 'string', `Non-string value for ${lang}.${k}`);
        assert.ok(bundle[lang][k].trim().length > 0, `Empty translation for ${lang}.${k}`);
      }
    }
  });

  it('serves bundled strings without calling upstream and falls back to upstream for unbundled strings', async () => {
    const upstreamCalls = [];
    const { server, baseUrl } = await startTestApp(createTranslateRoutes({
      env: {},
      fetchImpl: async (url) => {
        const q = new URL(url).searchParams.get('q');
        upstreamCalls.push(q);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            responseStatus: 200,
            quotaFinished: false,
            responseData: { translatedText: `live:${q}` },
          }),
        };
      },
    }));

    try {
      for (const lang of LANGUAGES.map((l) => l.code)) {
        const res = await fetch(`${baseUrl}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: ['Classic Milk Tea', 'Add to Order', 'Pause'], target: lang }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.translatedText.length, 3);
      }
      assert.equal(upstreamCalls.length, 0);

      const dynamicRes = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: ['Classic Milk Tea', 'New Seasonal Lychee Sparkler'], target: 'es' }),
      });
      assert.equal(dynamicRes.status, 200);
      const dynamicBody = await dynamicRes.json();
      assert.equal(dynamicBody.translatedText[0], 'Té con leche clásico');
      assert.equal(dynamicBody.translatedText[1], 'live:New Seasonal Lychee Sparkler');
      assert.deepEqual(upstreamCalls, ['New Seasonal Lychee Sparkler']);
    } finally {
      server.close();
    }
  });
});
