import { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_LT_URL ?? '/lt';
const SOURCE = 'en';
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const SKIP = 'script,style,noscript,code,pre,[translate="no"],[data-no-translate]';
const RTL = new Set(['ar', 'he', 'fa', 'ur']);
const CHUNK = 40;

const cache = new Map();          // "lang\0text" -> translation
const textRecs = new WeakMap();   // Text node -> { orig, applied }
const attrRecs = new WeakMap();   // Element -> { [attr]: { orig, applied } }

const hasLetters = (s) => /\p{L}/u.test(s);
const key = (lang, text) => `${lang}\0${text}`;

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
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK);
    const res = await fetch(`${API}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: chunk, source: SOURCE, target: lang, format: 'text' }),
      signal,
    });
    if (!res.ok) throw new Error(`Translation server returned ${res.status}`);
    const { translatedText } = await res.json();
    chunk.forEach((text, j) => cache.set(key(lang, text), translatedText[j]));
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
  onWork();

  await fetchTranslations(jobs.map((j) => j.core), lang, signal);
  if (signal.aborted) return;

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
    fetch(`${API}/languages`)
      .then((r) => r.json())
      .then((list) => {
        const en = list.find((l) => l.code === SOURCE);
        setLanguages(list.filter((l) => l.code !== SOURCE && en?.targets.includes(l.code)));
      })
      .catch(() => setError('Translation server unreachable'));
  }, []);

  useEffect(() => {
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';

    if (lang === SOURCE) {
      restorePage();
      setBusy(false);
      return undefined;
    }

    const ctrl = new AbortController();
    let timer;
    const run = async (force) => {
      try {
        setError('');
        await translatePage(lang, { force, signal: ctrl.signal, onWork: () => setBusy(true) });
      } catch (e) {
        if (e.name !== 'AbortError') setError('Translation failed');
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    };

    run(true);

    // Pick up content that appears or changes later (cart lines, fetched menu items, etc.)
    const observer = new MutationObserver((muts) => {
      if (muts.every((m) => widgetRef.current?.contains(m.target))) return;
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

  return (
    <div ref={widgetRef} className="translate-widget" translate="no">
      <label>
        <span aria-hidden="true">🌐</span>
        <span className="visually-hidden">Language</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          disabled={!languages.length && lang === SOURCE}
          aria-busy={busy}
        >
          <option value={SOURCE}>English</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </label>
      {busy && <span role="status" className="translate-status">Translating…</span>}
      {error && <span role="alert" className="translate-error">{error}</span>}
    </div>
  );
}