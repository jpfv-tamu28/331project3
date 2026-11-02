// Shared building blocks, the React counterparts of DenseList.java, Alerts.java and friends.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api';
import { dollars, money, quantity } from '../format';

/* ---------------- Data loading ---------------- */

/** Runs load() on mount and whenever deps change; reload() runs it again on demand. */
export function useResource(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    stableLoad()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((err) => !cancelled && setState((s) => ({ data: s.data, error: errorMessage(err), loading: false })));
    return () => {
      cancelled = true;
    };
  }, [stableLoad, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function StateMessage({ error, loading, onRetry, children }) {
  if (error) {
    return (
      <div className="state-message error" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  if (loading) {
    return <div className="state-message" role="status">Loading…</div>;
  }
  return <div className="state-message">{children}</div>;
}

/* ---------------- Toasts (Alerts.success / warning / error / info) ---------------- */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback((tone, title, message) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, tone, title, message }]);
    // Errors stay longer so they aren't missed.
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
  }, [dismiss]);

  const api = useMemo(() => ({
    info: (title, message) => notify('info', title, message),
    success: (title, message) => notify('success', title, message),
    warning: (title, message) => notify('warning', title, message),
    error: (title, message) => notify('error', title, message),
  }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast tone-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <div className="toast-text">
              <strong>{t.title}</strong>
              {t.message && <p>{t.message}</p>}
            </div>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

/* ---------------- Modal (Alerts.form / confirm) ---------------- */

/**
 * Native <dialog> opened with showModal(): it traps focus, makes the page behind it inert and closes on Esc.
 * Mount it only while it should be open. Enter submits, like the Java dialogs' default button.
 */
export function Modal({
  title, onClose, onSubmit, submitLabel = 'OK', cancelLabel = 'Cancel', tone, width,
  busy = false, headerAction, className = '', children,
}) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    // Focus the first editable field, otherwise the main button (Alerts.firstTextField).
    const field = dialog.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea');
    (field ?? dialog.querySelector('button[type=submit]'))?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-labelledby={titleId}
      style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="modal-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) (onSubmit ?? onClose)();
        }}
      >
        {tone && <div className={`modal-tone tone-${tone}`} />}
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {headerAction}
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {cancelLabel && onSubmit && (
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/* ---------------- Selection controls ---------------- */

/** Row of single-select filter buttons (DenseList.ChipBar). value may be null for "none highlighted". */
export function ChipBar({ options, value, onChange, label }) {
  return (
    <div className="chip-bar" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="chip"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Equal-width buttons where exactly one option is picked (DenseList.Segmented). */
export function Segmented({ options, value, onChange, label }) {
  const refs = useRef([]);
  // Arrow keys move between options, like a native radio group.
  const onKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value ?? options[next]);
    refs.current[next]?.focus();
  };
  const selectedIndex = options.findIndex((o) => (o.value ?? o) === value);
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option, i) => {
        const optValue = option.value ?? option;
        const checked = optValue === value;
        return (
          <button
            key={optValue}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(optValue)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {option.label ?? option}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ value, min = 0, max = 99, onChange, label, small = false }) {
  return (
    <div className={`stepper${small ? ' small' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        aria-label={`Decrease ${label}`}>
        −
      </button>
      <output className={value === 0 ? 'zero' : undefined} aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

/* ---------------- Layout pieces ---------------- */

/** Uppercase title on the left, muted note on the right (DenseList.sectionBar). */
export function SectionBar({ title, note, as: Heading = 'h3' }) {
  return (
    <div className="section-bar">
      <Heading>{title}</Heading>
      {note && <span>{note}</span>}
    </div>
  );
}

export function StatTiles({ tiles }) {
  return (
    <dl className="stat-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile">
          <dt>{t.label}</dt>
          <dd>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- Data table (DenseList.styledTable) ---------------- */

/**
 * columns: [{ key, label, type: 'text' | 'number' | 'money' (dollars) | 'cents' | 'id', render?(row) }]
 * Click a header to sort; clicking again reverses it. Rows are selectable when onSelect is given.
 */
export function DataTable({ columns, rows, rowKey, onSelect, selectedKey, emptyText = 'No rows', caption, rowClassName }) {
  const [sort, setSort] = useState(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      const x = a[key];
      const y = b[key];
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort]);

  const isNumeric = (col) => ['number', 'money', 'cents', 'id'].includes(col.type);
  const display = (col, row) => {
    if (col.render) return col.render(row);
    const v = row[col.key];
    if (v === null || v === undefined) return '';
    switch (col.type) {
      case 'money': return dollars(v);
      case 'cents': return money(v);
      case 'id': return `#${v}`;
      case 'number': return quantity(v);
      default: return v;
    }
  };
  const toggleSort = (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const selectable = Boolean(onSelect);
  return (
    <table className="data-table">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((col) => {
            const dir = sort?.key === col.key ? sort.dir : null;
            return (
              <th
                key={col.key}
                scope="col"
                className={isNumeric(col) ? 'num' : undefined}
                aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <button type="button" onClick={() => toggleSort(col.key)}>
                  {col.label}
                  <span aria-hidden="true">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}</span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="table-empty">{emptyText}</td>
          </tr>
        ) : (
          sorted.map((row) => {
            const key = rowKey(row);
            const classes = [selectable ? 'clickable' : '', rowClassName?.(row) ?? ''].join(' ').trim();
            return (
              <tr
                key={key}
                className={classes || undefined}
                aria-selected={selectable ? key === selectedKey : undefined}
                tabIndex={selectable ? 0 : undefined}
                onClick={selectable ? () => onSelect(row) : undefined}
                onKeyDown={selectable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(row);
                  }
                } : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={isNumeric(col) ? 'num' : undefined}>{display(col, row)}</td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

/* ---------------- Dense list (DenseList.java) ---------------- */

/**
 * Searchable list of rows grouped under section headers.
 * filters: [{ label, test(item) }], the first is selected initially.
 * describe(item) -> { title, subtitle, value, detail?, badge?: { text, alert? } }
 */
export function DenseList({ items, searchLabel, filters, groupOf, pinnedGroups = [], describe, onOpen, noun, actions }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(filters[0].label);

  const groups = useMemo(() => {
    const keep = filters.find((f) => f.label === filter)?.test ?? (() => true);
    const q = query.trim().toLowerCase();
    const map = new Map(pinnedGroups.map((g) => [g, []]));
    for (const item of items) {
      if (!keep(item)) continue;
      const row = describe(item);
      const group = groupOf(item);
      if (`${row.title} ${row.subtitle} ${group}`.toLowerCase().includes(q)) {
        if (!map.has(group)) map.set(group, []);
        map.get(group).push({ item, row });
      }
    }
    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [items, filters, filter, query, pinnedGroups, groupOf, describe]);

  return (
    <div className="dense-list">
      <div className="toolbar">
        <input
          type="search"
          className="field"
          placeholder={searchLabel}
          aria-label={searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ChipBar options={filters.map((f) => f.label)} value={filter} onChange={setFilter} label="Filter" />
        <div className="spacer" />
        {actions}
      </div>
      <div className="dense-list-body">
        {groups.length === 0 ? (
          <p className="state-message">Nothing matches</p>
        ) : (
          groups.map(([group, list]) => (
            <section key={group} aria-label={group}>
              <SectionBar title={group} note={`${list.length} ${noun}${list.length === 1 ? '' : 's'}`} />
              <ul>
                {list.map(({ item, row }) => (
                  <li key={item.id}>
                    <button type="button" className="dense-row" onClick={() => onOpen(item)}>
                      <span className="dense-row-text">
                        <strong>{row.title}</strong>
                        <span>{row.subtitle}</span>
                      </span>
                      {row.badge && (
                        <span className={`badge${row.badge.alert ? ' badge-alert' : ''}`}>{row.badge.text}</span>
                      )}
                      <span className="dense-row-value">
                        <strong>{row.value}</strong>
                        {row.detail && <span>{row.detail}</span>}
                      </span>
                      <span className="edit-chip">Edit</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
