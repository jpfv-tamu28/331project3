import { useMemo, useState } from 'react';
import { ChipBar } from './ChipBar';
import { SectionBar } from './SectionBar';

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
