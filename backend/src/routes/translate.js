import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { HttpError, asyncRoute } from '../http.js';

export const SOURCE_LANGUAGE = 'en';

export const LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ar', name: 'Arabic' },
];

const SUPPORTED_TARGETS = new Set(LANGUAGES.map((l) => l.code));
const MAX_BATCH_ITEMS = 60;
const MAX_ITEM_LENGTH = 2000;
const MAX_CACHE_ENTRIES = 5000;
const UPSTREAM_TIMEOUT_MS = 8000;
const MYMEMORY_MAX_BYTES = 450;
const MYMEMORY_CONCURRENCY = 6;

const hasLetters = (s) => /\p{L}/u.test(s);
const cacheKey = (target, text) => `${target}\0${text}`;

function loadBundledTranslations() {
  const map = new Map();
  const raw = JSON.parse(readFileSync(new URL('../../../shared/kioskTranslations.json', import.meta.url), 'utf8'));
  for (const [lang, entries] of Object.entries(raw)) {
    for (const [text, translated] of Object.entries(entries)) {
      map.set(cacheKey(lang, text), translated);
    }
  }
  return map;
}

export const BUNDLED_TRANSLATIONS = loadBundledTranslations();

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Decodes common HTML entities returned by translation APIs (e.g. Google v2 / MyMemory). */
export function decodeEntities(text) {
  if (typeof text !== 'string' || !text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (NAMED_ENTITIES[lower]) return NAMED_ENTITIES[lower];
    const cp = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
  });
}

function splitLongToken(token, maxBytes) {
  const parts = [];
  let current = '';
  for (const ch of token) {
    if (Buffer.byteLength(current + ch, 'utf8') > maxBytes) {
      if (current) parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Splits text into segments of at most `maxBytes` UTF-8 bytes so MyMemory's 500-byte limit isn't exceeded. */
export function splitForMyMemory(text, maxBytes = MYMEMORY_MAX_BYTES) {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const tokens = [];
  for (const sentence of sentences) {
    if (Buffer.byteLength(sentence, 'utf8') <= maxBytes) {
      tokens.push(sentence);
      continue;
    }
    for (const word of sentence.split(/\s+/).filter(Boolean)) {
      if (Buffer.byteLength(word, 'utf8') <= maxBytes) {
        tokens.push(word);
      } else {
        tokens.push(...splitLongToken(word, maxBytes));
      }
    }
  }

  const chunks = [];
  let current = '';
  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (Buffer.byteLength(candidate, 'utf8') <= maxBytes) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = token;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function fetchJsonWithTimeout(fetchImpl, url, init = {}) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`${url} failed: ${err.cause?.code ?? err.cause?.message ?? err.message}`);
  }
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return res.json();
}

async function translateWithGoogle(texts, source, target, { fetchImpl, apiKey }) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJsonWithTimeout(fetchImpl, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source, target, format: 'text' }),
  });
  const list = data?.data?.translations;
  if (!Array.isArray(list) || list.length !== texts.length) {
    throw new Error('Unexpected response from Google Translate');
  }
  return list.map((item) => {
    if (typeof item?.translatedText !== 'string') {
      throw new Error('Unexpected translation entry from Google Translate');
    }
    return decodeEntities(item.translatedText);
  });
}

async function translateWithLibre(texts, source, target, { fetchImpl, baseUrl, apiKey }) {
  const base = baseUrl.replace(/\/+$/, '');
  const ltTarget = target === 'zh-CN' ? 'zh' : target;
  const payload = { q: texts, source, target: ltTarget, format: 'text' };
  if (apiKey) payload.api_key = apiKey;

  const data = await fetchJsonWithTimeout(fetchImpl, `${base}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (Array.isArray(data?.translatedText) && data.translatedText.length === texts.length) {
    return data.translatedText.map((s) => String(s));
  }
  if (typeof data?.translatedText === 'string' && texts.length === 1) {
    return [data.translatedText];
  }
  throw new Error('Unexpected response from LibreTranslate');
}

async function translateOneMyMemory(text, source, target, { fetchImpl, email }) {
  const parts = splitForMyMemory(text);
  const translatedParts = [];
  for (const part of parts) {
    const params = new URLSearchParams({ q: part, langpair: `${source}|${target}` });
    if (email) params.set('de', email);
    const data = await fetchJsonWithTimeout(fetchImpl, `https://api.mymemory.translated.net/get?${params}`);
    const status = Number(data?.responseStatus);
    const translated = data?.responseData?.translatedText;
    if (
      status !== 200
      || data?.quotaFinished
      || typeof translated !== 'string'
      || /^MYMEMORY WARNING/i.test(translated)
    ) {
      throw new Error(data?.responseDetails || translated || `MyMemory status ${data?.responseStatus}`);
    }
    translatedParts.push(decodeEntities(translated));
  }
  return translatedParts.join(' ');
}

async function translateWithMyMemory(texts, source, target, { fetchImpl, email }) {
  const results = new Array(texts.length);
  let nextIndex = 0;
  const workerCount = Math.min(MYMEMORY_CONCURRENCY, texts.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < texts.length) {
        const idx = nextIndex;
        nextIndex += 1;
        results[idx] = await translateOneMyMemory(texts[idx], source, target, { fetchImpl, email });
      }
    }),
  );
  return results;
}

function setCached(cache, key, value) {
  if (cache.has(key)) cache.delete(key);
  else if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}

function parseTranslateBody(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  const source = body.source == null ? SOURCE_LANGUAGE : String(body.source);
  const target = typeof body.target === 'string' ? body.target : '';
  if (!target || (target !== SOURCE_LANGUAGE && !SUPPORTED_TARGETS.has(target))) {
    throw new HttpError(400, `Unsupported target language "${target}".`);
  }
  if (source !== SOURCE_LANGUAGE && source !== target) {
    throw new HttpError(400, 'Only translations from English are supported.');
  }

  const isArray = Array.isArray(body.q);
  const texts = isArray ? body.q : [body.q];
  if (texts.length === 0 || texts.length > MAX_BATCH_ITEMS) {
    throw new HttpError(400, `Provide between 1 and ${MAX_BATCH_ITEMS} strings to translate.`);
  }
  for (const item of texts) {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'Every item in q must be a string.');
    }
    if (item.length > MAX_ITEM_LENGTH) {
      throw new HttpError(400, `Each string must be at most ${MAX_ITEM_LENGTH} characters.`);
    }
  }
  return { source, target, isArray, texts };
}

/** Creates the /api/translate router with injectable fetch, env, cache, and bundled translations for tests. */
export function createTranslateRoutes({
  fetchImpl = fetch, env = process.env, cache = new Map(), bundled = BUNDLED_TRANSLATIONS,
} = {}) {
  const router = Router();
  const inFlight = new Map();

  async function translateBatch(texts, source, target) {
    const providers = [];
    if (env.GOOGLE_TRANSLATE_API_KEY) {
      providers.push(['google', () => translateWithGoogle(texts, source, target, {
        fetchImpl,
        apiKey: env.GOOGLE_TRANSLATE_API_KEY,
      })]);
    }
    if (env.LIBRETRANSLATE_URL) {
      providers.push(['libretranslate', () => translateWithLibre(texts, source, target, {
        fetchImpl,
        baseUrl: env.LIBRETRANSLATE_URL,
        apiKey: env.LIBRETRANSLATE_API_KEY,
      })]);
    }
    providers.push(['mymemory', () => translateWithMyMemory(texts, source, target, {
      fetchImpl,
      email: env.MYMEMORY_EMAIL?.trim() || '',
    })]);

    for (const [name, run] of providers) {
      try {
        return await run();
      } catch (err) {
        console.warn(`[WARN] Translation provider (${name}) failed:`, err.message);
      }
    }
    throw new HttpError(502, 'The translation service is unavailable right now.');
  }

  // GET /api/translate/languages -> [{ code, name, targets }]
  router.get('/languages', (_req, res) => {
    const targetCodes = LANGUAGES.map((l) => l.code);
    res.json([
      { code: SOURCE_LANGUAGE, name: 'English', targets: targetCodes },
      ...LANGUAGES.map((l) => ({ ...l, targets: [SOURCE_LANGUAGE] })),
    ]);
  });

  // POST /api/translate { q: string | string[], source?: 'en', target } -> { translatedText }
  router.post('/', asyncRoute(async (req, res) => {
    const { source, target, isArray, texts } = parseTranslateBody(req.body);
    if (target === source) {
      res.json({ translatedText: isArray ? texts : texts[0] });
      return;
    }

    const toFetch = [];
    const seenMissing = new Set();
    const waitList = new Map();

    for (const text of texts) {
      if (!hasLetters(text)) continue;
      const ck = cacheKey(target, text);
      if (bundled.has(ck) || cache.has(ck) || seenMissing.has(ck)) continue;
      seenMissing.add(ck);
      if (inFlight.has(ck)) {
        waitList.set(ck, inFlight.get(ck));
      } else {
        toFetch.push(text);
      }
    }

    if (toFetch.length > 0) {
      const batchPromise = translateBatch(toFetch, source, target).then((translatedList) => {
        const mapped = new Map();
        toFetch.forEach((text, i) => {
          const ck = cacheKey(target, text);
          const translated = translatedList[i];
          setCached(cache, ck, translated);
          mapped.set(ck, translated);
        });
        return mapped;
      });

      for (const text of toFetch) {
        const ck = cacheKey(target, text);
        const itemPromise = batchPromise.then((mapped) => mapped.get(ck));
        inFlight.set(ck, itemPromise);
        waitList.set(ck, itemPromise);
        itemPromise.finally(() => {
          if (inFlight.get(ck) === itemPromise) inFlight.delete(ck);
        }).catch(() => {});
      }
    }

    if (waitList.size > 0) {
      await Promise.all(waitList.values());
    }

    const results = texts.map((text) => {
      if (!hasLetters(text)) return text;
      const ck = cacheKey(target, text);
      return bundled.get(ck) ?? cache.get(ck) ?? text;
    });
    res.json({ translatedText: isArray ? results : results[0] });
  }));

  return router;
}

export default createTranslateRoutes();
