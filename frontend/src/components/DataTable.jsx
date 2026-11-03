import { useMemo, useState } from 'react';
import { dollars, money, quantity } from '../format';

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
