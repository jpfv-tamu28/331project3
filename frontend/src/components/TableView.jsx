import { useMemo, useState } from 'react';
import { ChipBar } from './ChipBar';
import { DataTable } from './DataTable';

/**
 * Toolbar (search, filter chips, actions) over a sortable DataTable: the layout the Reports,
 * Discounts and X-Report tabs use, for lists whose rows open an editor when clicked.
 * filters: [{ label, test(row) }], the first is selected initially.
 * searchText(row) -> the text the search box matches against.
 */
export function TableView({
  rows, columns, rowKey, caption, searchLabel, searchText, filters, actions, onSelect, rowClassName, noun,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(filters?.[0]?.label);

  const shown = useMemo(() => {
    const keep = filters?.find((f) => f.label === filter)?.test ?? (() => true);
    const q = query.trim().toLowerCase();
    return rows.filter((row) => keep(row) && (!q || searchText(row).toLowerCase().includes(q)));
  }, [rows, filters, filter, query, searchText]);

  const narrowed = shown.length !== rows.length;
  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="field"
          placeholder={searchLabel}
          aria-label={searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filters && (
          <ChipBar options={filters.map((f) => f.label)} value={filter} onChange={setFilter} label="Filter" />
        )}
        <span className="subtle table-count" aria-live="polite">
          {narrowed ? `${shown.length} of ${rows.length}` : rows.length} {noun}{rows.length === 1 ? '' : 's'}
        </span>
        <div className="spacer" />
        {actions}
      </div>
      <div className="panel-fill table-wrap">
        <DataTable
          caption={caption}
          columns={columns}
          rows={shown}
          rowKey={rowKey}
          onSelect={onSelect}
          rowClassName={rowClassName}
          emptyText={rows.length === 0 ? `No ${noun}s yet` : 'Nothing matches'}
        />
      </div>
    </>
  );
}

/** A status pill for a table cell, e.g. "Low stock" or "Inactive". */
export function StatusBadge({ text, alert = false }) {
  return <span className={`badge${alert ? ' badge-alert' : ''}`}>{text}</span>;
}
