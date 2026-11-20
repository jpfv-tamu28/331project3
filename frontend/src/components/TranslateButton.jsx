import { useEffect, useRef, useState } from 'react';
import { Api } from '../api';
import globeIcon from '../assets/translate_icon.png';
import bundledTranslations from '../../../shared/kioskTranslations.json';

const SOURCE = 'en';
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const SKIP = 'script,style,noscript,code,pre,.magnifier,[translate="no"],[data-no-translate]';
const RTL = new Set(['ar', 'he', 'fa', 'ur']);
const CHUNK = 25;
const STORAGE_CACHE_KEY = 'kiosk-translations-v1';
const MAX_DYNAMIC_CACHE = 500;

const cache = new Map();          // "lang\0text" -> translation
const bundledKeys = new Set();    // keys already shipped in bundledTranslations
const dynamicCache = new Map();   // dynamically fetched translations persisted in localStorage
const textRecs = new WeakMap();   // Text node -> { orig, applied }
const attrRecs = new WeakMap();   // Element -> { [attr]: { orig, applied } }

const hasLetters = (s) => /\p{L}/u.test(s);
const key = (lang, text) => `${lang}\0${text}`;

// Pre-seed the in-memory cache from the static bundle so switching languages is instant.
for (const [lang, entries] of Object.entries(bundledTranslations)) {
  for (const [text, translated] of Object.entries(entries)) {
    const k = key(lang, text);
    cache.set(k, translated);
    bundledKeys.add(k);
  }
}

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_CACHE_KEY) || 'null');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [k, v] of Object.entries(saved)) {
      if (typeof v === 'string' && !bundledKeys.has(k)) {
        cache.set(k, v);
        dynamicCache.set(k, v);
      }
    }
  }
} catch {
  /* ignore storage errors */
}

function saveDynamic(k, value) {
  if (bundledKeys.has(k)) return;
  if (dynamicCache.has(k)) dynamicCache.delete(k);
  else if (dynamicCache.size >= MAX_DYNAMIC_CACHE) {
    dynamicCache.delete(dynamicCache.keys().next().value);
  }
  dynamicCache.set(k, value);
}

function flushDynamicCache() {
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(Object.fromEntries(dynamicCache)));
  } catch {
    /* ignore storage quota/access errors */
  }
}

function collect(root) {
  const targets = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (el && !el.closest(SKIP) && hasLetters(n.nodeValue)) {
      targets.push({ node: n, attr: null, current: n.nodeValue });
    }
  }
  root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach((el) => {
    if (el.closest(SKIP)) return;
    for (const attr of ATTRS) {
      const v = el.getAttribute(attr);
      if (v && hasLetters(v)) targets.push({ node: el, attr, current: v });
    }
  });
  return targets;
}

const readNow = (t) => (t.attr ? t.node.getAttribute(t.attr) : t.node.nodeValue);
const write = (t, v) => (t.attr ? t.node.setAttribute(t.attr, v) : (t.node.nodeValue = v));
const getRec = (t) => (t.attr ? attrRecs.get(t.node)?.[t.attr] : textRecs.get(t.node));
function setRec(t, rec) {
  if (!t.attr) textRecs.set(t.node, rec);
  else attrRecs.set(t.node, { ...attrRecs.get(t.node), [t.attr]: rec });
}
function clearRec(t) {
  if (!t.attr) textRecs.delete(t.node);
  else {
    const r = { ...attrRecs.get(t.node) };
    delete r[t.attr];
    attrRecs.set(t.node, r);
  }
}

async function fetchTranslations(texts, lang, signal) {
  const todo = [...new Set(texts)].filter((t) => !cache.has(key(lang, t)));
  if (todo.length === 0) return;
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK);
    const { translatedText } = await Api.translate(chunk, lang, { signal });
    if (!Array.isArray(translatedText) || translatedText.length !== chunk.length) {
      throw new Error('Unexpected response from translation server');
    }
    chunk.forEach((text, j) => {
      const k = key(lang, text);
      cache.set(k, translatedText[j]);
      saveDynamic(k, translatedText[j]);
    });
    flushDynamicCache();
  }
}

async function translatePage(lang, { force, signal, onWork }) {
  const jobs = [];
  for (const t of collect(document.body)) {
    const rec = getRec(t);
    const owned = rec && rec.applied === t.current; // text we wrote ourselves
    if (owned && !force) continue;
    const orig = owned ? rec.orig : t.current;
    const [, pre, core, post] = orig.match(/^(\s*)([\s\S]*?)(\s*)$/);
    jobs.push({ t, orig, pre, core, post });
  }
  if (!jobs.length) return;

  const missing = [...new Set(jobs.map((j) => j.core))].filter((c) => !cache.has(key(lang, c)));
  if (missing.length > 0) {
    onWork();
    await fetchTranslations(missing, lang, signal);
    if (signal.aborted) return;
  }

  for (const { t, orig, pre, core, post } of jobs) {
    if (readNow(t) !== t.current) continue; // changed while waiting; next pass handles it
    const value = pre + (cache.get(key(lang, core)) ?? core) + post;
    setRec(t, { orig, applied: value });
    if (value !== t.current) write(t, value);
  }
}

function restorePage() {
  for (const t of collect(document.body)) {
    const rec = getRec(t);
    if (rec && rec.applied === t.current) {
      write(t, rec.orig);
      clearRec(t);
    }
  }
}

export default function TranslateButton() {
  const [languages, setLanguages] = useState([]);
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || SOURCE; } catch { return SOURCE; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const widgetRef = useRef(null);

  // Load the languages the server can translate English into.
  useEffect(() => {
    let cancelled = false;
    Api.translateLanguages()
      .then((list) => {
        if (cancelled) return;
        const en = list.find((l) => l.code === SOURCE);
        const supported = list.filter((l) => l.code !== SOURCE && en?.targets.includes(l.code));
        setLanguages(supported);
        setLang((current) => (current === SOURCE || supported.some((l) => l.code === current) ? current : SOURCE));
      })
      .catch(() => {
        if (!cancelled) setError('Translation server unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';

    if (lang === SOURCE) {
      restorePage();
      return undefined;
    }

    const ctrl = new AbortController();
    let timer;
    const run = async (force) => {
      try {
        await translatePage(lang, { force, signal: ctrl.signal, onWork: () => setBusy(true) });
        if (!ctrl.signal.aborted) setError('');
      } catch (e) {
        const canceled = e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED';
        if (!canceled) setError('Translation failed');
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    };

    run(true);

    const isIgnored = (node) => {
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      return Boolean(widgetRef.current?.contains(node) || el?.closest('.magnifier'));
    };

    // Pick up content that appears or changes later (cart lines, fetched menu items, etc.)
    const observer = new MutationObserver((muts) => {
      if (muts.every((m) => isIgnored(m.target))) return;
      clearTimeout(timer);
      timer = setTimeout(() => run(false), 200);
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS,
    });

    return () => {
      ctrl.abort();
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [lang]);

  const isBusy = lang !== SOURCE && busy;
  return (
    <div ref={widgetRef} className="translate-widget" translate="no">
      <label>
        <img src={globeIcon} alt="" className="translate-icon" />
        <span className="visually-hidden">Language</span>
        <select
          value={lang}
          onChange={(e) => {
            setError('');
            setBusy(false);
            setLang(e.target.value);
          }}
          disabled={!languages.length && lang === SOURCE}
          aria-busy={isBusy}
        >
          <option value={SOURCE}>English</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </label>
      {isBusy && <span role="status" className="translate-status">Translating…</span>}
      {error && <span role="alert" className="translate-error">{error}</span>}
    </div>
  );
}
